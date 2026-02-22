import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { Server as SocketServer } from 'socket.io';
import { ScanConfig } from '../models/scan.model.js';
import { PageModel } from '../models/page.model.js';
import { normalizeUrl, isSameOrigin, shouldSkipUrl, resolveUrl } from '../utils/url.utils.js';
import { logger } from '../utils/logger.js';

interface CrawlResult {
  url: string;
  title: string | null;
  httpStatus: number;
  loadTimeMs: number;
  links: string[];
}

export class CrawlerService {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private visited: Set<string> = new Set();
  private queue: Array<{ url: string; depth: number }> = [];
  private io: SocketServer | null = null;
  private scanId: string = '';
  private config: ScanConfig | null = null;
  private rootOrigin: string = '';
  private isCancelled: boolean = false;

  async initialize(io: SocketServer): Promise<void> {
    this.io = io;
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    logger.info('Playwright browser launched');
  }

  async crawl(scanId: string, rootUrl: string, config: ScanConfig): Promise<string[]> {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    this.scanId = scanId;
    this.config = config;
    this.visited.clear();
    this.queue = [];
    this.isCancelled = false;

    const normalizedRoot = normalizeUrl(rootUrl);
    this.rootOrigin = new URL(normalizedRoot).origin;

    this.context = await this.browser.newContext({
      viewport: config.viewport,
      userAgent: 'A11yCrawler/1.0 (WCAG Accessibility Scanner)',
    });
    // Set default navigation timeout to prevent hanging
    this.context.setDefaultNavigationTimeout(30000);
    this.context.setDefaultTimeout(30000);

    this.queue.push({ url: normalizedRoot, depth: 0 });
    const discoveredUrls: string[] = [];

    while (this.queue.length > 0 && this.visited.size < config.maxPages && !this.isCancelled) {
      const batch = this.queue.splice(0, config.concurrency);
      const results = await Promise.all(
        batch.map(item => this.crawlPage(item.url, item.depth))
      );

      for (const result of results) {
        if (result) {
          discoveredUrls.push(result.url);
          this.processLinks(result.links, result.url, batch[0]?.depth ?? 0);
        }
      }

      // Rate limiting
      if (this.queue.length > 0 && config.delay > 0) {
        await this.delay(config.delay);
      }
    }

    await this.context.close();
    this.context = null;

    logger.info(`Crawl complete: ${discoveredUrls.length} pages discovered`, { scanId });
    return discoveredUrls;
  }

  private async crawlPage(url: string, depth: number): Promise<CrawlResult | null> {
    if (this.visited.has(url)) {
      return null;
    }

    if (shouldSkipUrl(url, this.config?.excludePatterns || [])) {
      logger.debug(`Skipping URL: ${url}`);
      return null;
    }

    if (!isSameOrigin(url, this.rootOrigin)) {
      return null;
    }

    this.visited.add(url);

    const page = await this.context!.newPage();
    const startTime = Date.now();

    try {
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      // Give page a moment to finish loading dynamic content
      await page.waitForTimeout(1000);

      const httpStatus = response?.status() || 0;
      const loadTimeMs = Date.now() - startTime;

      // Wait for custom selector if specified
      if (this.config?.waitForSelector) {
        await page.waitForSelector(this.config.waitForSelector, { timeout: 5000 }).catch(() => {});
      }

      const title = await page.title();

      // Extract all links
      const links = await page.evaluate(() => {
        const anchors = document.querySelectorAll('a[href]');
        return Array.from(anchors).map(a => (a as HTMLAnchorElement).href).filter(Boolean);
      });

      // Save page to database
      const pageRecord = PageModel.create(this.scanId, url);
      PageModel.updateStatus(pageRecord.id, 'pending', { title, http_status: httpStatus, load_time_ms: loadTimeMs });

      // Emit event
      this.io?.to(this.scanId).emit('crawl:page:found', {
        scanId: this.scanId,
        url,
        title,
        depth,
        totalFound: this.visited.size,
      });

      logger.info(`Crawled: ${url}`, { httpStatus, loadTimeMs, linksFound: links.length });

      return { url, title, httpStatus, loadTimeMs, links };
    } catch (error) {
      logger.error(`Failed to crawl: ${url}`, { error: (error as Error).message });

      // Still record the page as discovered but with error
      const pageRecord = PageModel.create(this.scanId, url);
      PageModel.updateStatus(pageRecord.id, 'error');

      return null;
    } finally {
      await page.close();
    }
  }

  private processLinks(links: string[], currentUrl: string, currentDepth: number): void {
    if (!this.config || currentDepth >= this.config.maxDepth) {
      return;
    }

    for (const link of links) {
      const resolved = resolveUrl(currentUrl, link);
      if (!resolved) continue;

      const normalized = normalizeUrl(resolved);

      if (
        !this.visited.has(normalized) &&
        !this.queue.some(q => q.url === normalized) &&
        isSameOrigin(normalized, this.rootOrigin) &&
        !shouldSkipUrl(normalized, this.config.excludePatterns)
      ) {
        this.queue.push({ url: normalized, depth: currentDepth + 1 });
      }
    }
  }

  cancel(): void {
    this.isCancelled = true;
    logger.info('Crawl cancelled', { scanId: this.scanId });
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    logger.info('Browser closed');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const crawlerService = new CrawlerService();
