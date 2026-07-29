import { Router, Request, Response, type RequestHandler } from 'express';
import { z } from 'zod';
import { Server as SocketServer } from 'socket.io';
import { ScanModel, ScanConfig } from '../models/scan.model.js';
import { PageModel } from '../models/page.model.js';
import { crawlerService } from '../services/crawler.service.js';
import { scannerService } from '../services/scanner.service.js';
import { scanJobScheduler } from '../services/scan-job-scheduler.js';
import { deduplicationService } from '../services/deduplication.service.js';
import { reportService } from '../services/report.service.js';
import { logger } from '../utils/logger.js';
import { isValidScanUrl, normalizeUrl } from '../utils/url.utils.js';
import { describeSkipReason } from '../utils/audit.utils.js';
import {
  applyEntitlements,
  policyForPrincipal,
  type EntitlementResolver,
} from '../entitlements/policy.js';
import {
  redactCredentialText,
  redactScanConfig,
  redactUrlCredentials,
  urlHasCredentials,
} from '../entitlements/redaction.js';
import { getPrincipal } from '../auth/middleware.js';
import { createScanCreationRateLimiter } from '../auth/scan-rate-limit.js';
import { createScanCapability, isScanAccessible } from '../auth/scan-access.js';
import {
  isPubliclyRoutableUrl,
  type PublicUrlChecker,
} from '../auth/network-policy.js';

// Custom URL validator that accepts localhost and local network URLs
const urlSchema = z.string().refine(
  (url) => isValidScanUrl(url) && !urlHasCredentials(url),
  { message: 'Invalid URL. Must be HTTP or HTTPS and must not contain embedded credentials.' }
);

const loginUrlSchema = z.string().url().refine(
  (url) => !urlHasCredentials(url),
  { message: 'Login URL must not contain embedded credentials.' },
);

const scanConfigSchema = z.object({
  url: urlSchema,
  capabilityProtocol: z.literal(1).optional(),
  config: z.object({
    // Entitlement fields carry NO schema default — a tier-agnostic default would
    // wrongly give admins a finite cap and force spurious clamps on lower tiers.
    // When omitted they are filled from the resolved policy below. `null`
    // requests a truly unlimited page count (admin only); finite tiers clamp it.
    maxPages: z.number().min(1).max(100).nullable().optional(),
    maxDepth: z.number().min(1).max(5).optional(),
    concurrency: z.number().min(1).max(5).optional(),
    delay: z.number().min(0).max(5000).default(500),
    excludePatterns: z.array(z.string()).default([]),
    waitForSelector: z.string().nullable().default(null),
    respectRobotsTxt: z.boolean().default(true),
    viewport: z.object({
      width: z.number().default(1280),
      height: z.number().default(720),
    }).default({ width: 1280, height: 720 }),
    authentication: z.object({
      authType: z.enum(['form', 'basic']).default('form'),
      loginUrl: loginUrlSchema,
      username: z.string(),
      password: z.string(),
    }).nullable().default(null),
    wcagVersion: z.enum(['2.1', '2.2']).default('2.1'),
  }).default({}),
});

/**
 * The background scan pipeline, injected so route tests can exercise
 * entitlement/persistence behaviour without launching Playwright.
 */
export type ScanRunner = (
  scanId: string,
  rootUrl: string,
  config: ScanConfig,
  io: SocketServer,
) => Promise<void>;

export interface ScanRoutesOptions {
  /** Maps a request to its entitlement policy. Defaults to the principal's role. */
  resolver?: EntitlementResolver;
  /** Runs the scan pipeline. Defaults to the real Playwright-backed runScan. */
  runner?: ScanRunner;
  scanCreateRateLimiter?: RequestHandler;
  publicUrlChecker?: PublicUrlChecker;
  cancelScan?: (scanId: string) => boolean;
  isScanScheduled?: (scanId: string) => boolean;
}

export function createScanRoutes(io: SocketServer, options: ScanRoutesOptions = {}): Router {
  const router = Router();
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    next();
  });
  const scanCreateRateLimiter = options.scanCreateRateLimiter ?? createScanCreationRateLimiter();
  const runner = options.runner ?? runScan;
  const publicUrlChecker = options.publicUrlChecker ?? isPubliclyRoutableUrl;
  const cancelScan = options.cancelScan ?? (scanId => scanJobScheduler.cancel(scanId));
  const isScanScheduled = options.isScanScheduled ?? (scanId => scanJobScheduler.has(scanId));

  const canAccess = (req: Request, res: Response, scanId: string): boolean => {
    const access = ScanModel.findAccessById(scanId);
    return access !== null && isScanAccessible(
      access,
      getPrincipal(res),
      req.header('X-Scan-Token') ?? undefined,
    );
  };

  // POST /api/scans - Start a new scan
  router.post('/', scanCreateRateLimiter, async (req: Request, res: Response) => {
    try {
      const parsed = scanConfigSchema.parse(req.body);

      // Resolve the request's entitlement policy (request-scoped seam).
      const principal = getPrincipal(res);
      const policy = options.resolver ? options.resolver(req) : policyForPrincipal(principal);

      // Fill omitted entitlement fields from the resolved policy (tier-aware
      // defaults). An explicit `maxPages: null` is preserved so finite tiers
      // clamp it and admin keeps its unlimited cap; global non-entitlement
      // defaults were already applied by the schema.
      const requestedConfig: ScanConfig = {
        ...parsed.config,
        maxPages: parsed.config.maxPages === undefined ? policy.maxPages : parsed.config.maxPages,
        maxDepth: parsed.config.maxDepth ?? policy.maxDepth,
        concurrency: parsed.config.concurrency ?? policy.maxConcurrency,
      };

      if (principal.kind === 'anonymous' && parsed.capabilityProtocol !== 1) {
        res.status(428).json({
          error: 'Anonymous capability protocol v1 is required',
          code: 'capability_protocol_required',
        });
        return;
      }

      if (principal.kind !== 'admin' && !(await publicUrlChecker(parsed.url))) {
        res.status(400).json({
          error: 'Target URL is not available for public scanning',
          code: 'target_not_public',
        });
        return;
      }

      // Authentication gate: deny before any DB write if the tier forbids it.
      if (requestedConfig.authentication && !policy.allowAuthentication) {
        res.status(403).json({
          error: 'Authenticated scans are not permitted on this tier',
          code: 'authentication_not_entitled',
          tier: policy.tier,
        });
        return;
      }

      // Clamp numeric overages to the tier caps (never reject). The effective
      // config carries full credentials in-memory for the runner.
      const { config: effectiveConfig, adjustments, tier } = applyEntitlements(requestedConfig, policy);

      const capability = principal.kind === 'anonymous' ? createScanCapability() : null;
      // Create scan record (ScanModel redacts credentials before persisting).
      const scan = ScanModel.create(parsed.url, effectiveConfig, {
        ownerGoogleSub: principal.kind === 'anonymous' ? null : principal.googleSub,
        accessTokenHash: capability?.hash ?? null,
      });
      logger.info('Scan created', {
        scanId: scan.id,
        url: redactUrlCredentials(parsed.url),
        tier,
        adjustments: adjustments.length,
      });

      // Start scan in background with the full effective (credentialed) config.
      runner(scan.id, parsed.url, effectiveConfig, io).catch(error => {
        const safeError = redactCredentialText(error.message);
        logger.error('Scan failed', { scanId: scan.id, error: safeError });
        ScanModel.updateStatus(scan.id, 'failed', safeError);
        io.to(scan.id).emit('scan:status', { scanId: scan.id, status: 'failed', error: safeError });
        io.to(scan.id).emit('scan:error', { scanId: scan.id, error: safeError });
      });

      res.status(201).json({
        id: scan.id,
        status: scan.status,
        rootUrl: scan.root_url,
        entitlement: { tier, adjustments },
        // Disclose the effective config so the client can show what was applied.
        // Redacted so credentials are never returned.
        effectiveConfig: redactScanConfig(effectiveConfig),
        accessToken: capability?.token,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        logger.error('Failed to create scan', { error: (error as Error).message });
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  // GET /api/scans - List all scans
  router.get('/', (req: Request, res: Response) => {
    try {
      const requestedLimit = Number.parseInt(String(req.query.limit ?? ''), 10);
      const requestedOffset = Number.parseInt(String(req.query.offset ?? ''), 10);
      const limit = Number.isFinite(requestedLimit)
        ? Math.min(100, Math.max(1, requestedLimit))
        : 50;
      const offset = Number.isFinite(requestedOffset) ? Math.max(0, requestedOffset) : 0;
      const principal = getPrincipal(res);
      const scans = principal.kind === 'admin'
        ? ScanModel.findAll(limit, offset)
        : principal.kind === 'user'
          ? ScanModel.findAllByOwner(principal.googleSub, limit, offset)
          : [];
      res.json(scans);
    } catch (error) {
      logger.error('Failed to list scans', { error: (error as Error).message });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/scans/:id - Get scan details
  router.get('/:id', (req: Request, res: Response) => {
    try {
      if (!canAccess(req, res, req.params.id)) {
        res.status(404).json({ error: 'Scan not found' });
        return;
      }
      const scan = ScanModel.findById(req.params.id)!;

      const pages = PageModel.findByScanId(scan.id);
      res.json({
        ...scan,
        pages: pages.map(p => ({
          id: p.id,
          url: p.url,
          title: p.title,
          status: p.status,
          issueCount: p.issue_count,
          skipReason: p.skip_reason,
          httpStatus: p.http_status,
        })),
      });
    } catch (error) {
      logger.error('Failed to get scan', { error: (error as Error).message });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // DELETE /api/scans/:id - Delete a scan
  router.delete('/:id', (req: Request, res: Response) => {
    try {
      if (!canAccess(req, res, req.params.id)) {
        res.status(404).json({ error: 'Scan not found' });
        return;
      }
      const scan = ScanModel.findById(req.params.id)!;

      if (isScanScheduled(scan.id) || (scan.status !== 'complete' && scan.status !== 'failed')) {
        res.status(409).json({
          error: 'Scan must be cancelled or complete before deletion',
          code: 'scan_not_terminal',
        });
        return;
      }

      ScanModel.delete(scan.id);
      logger.info('Scan deleted', { scanId: scan.id });
      res.status(204).send();
    } catch (error) {
      logger.error('Failed to delete scan', { error: (error as Error).message });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/scans/:id/cancel - Cancel a running scan
  router.post('/:id/cancel', (req: Request, res: Response) => {
    try {
      if (!canAccess(req, res, req.params.id)) {
        res.status(404).json({ error: 'Scan not found' });
        return;
      }
      const scan = ScanModel.findById(req.params.id)!;

      if (!cancelScan(scan.id)) {
        res.status(409).json({ error: 'Scan is not running', code: 'scan_not_running' });
        return;
      }
      ScanModel.updateStatus(scan.id, 'failed', 'Scan cancelled by user');
      io.to(scan.id).emit('scan:status', { scanId: scan.id, status: 'failed', error: 'Scan cancelled by user' });
      logger.info('Scan cancelled', { scanId: scan.id });
      res.json({ message: 'Scan cancelled' });
    } catch (error) {
      logger.error('Failed to cancel scan', { error: (error as Error).message });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

// A cancelled scan is marked 'failed' by the cancel route while runScan is
// still executing — later phases must not overwrite that status
function wasCancelled(scanId: string): boolean {
  return ScanModel.findById(scanId)?.status === 'failed';
}

async function runScan(scanId: string, rootUrl: string, config: ScanConfig, io: SocketServer): Promise<void> {
  return scanJobScheduler.enqueue(
    scanId,
    () => executeScan(scanId, rootUrl, config, io),
    () => {
      crawlerService.cancel();
      scannerService.cancel();
    },
  );
}

async function executeScan(scanId: string, rootUrl: string, config: ScanConfig, io: SocketServer): Promise<void> {
  try {
    await executeScanPhases(scanId, rootUrl, config, io);
  } finally {
    await Promise.allSettled([crawlerService.close(), scannerService.close()]);
  }
}

async function executeScanPhases(scanId: string, rootUrl: string, config: ScanConfig, io: SocketServer): Promise<void> {
  // Phase 1: Crawling
  ScanModel.updateStatus(scanId, 'crawling');
  io.to(scanId).emit('scan:status', { scanId, status: 'crawling' });

  await crawlerService.initialize(io);
  const discoveredUrls = await crawlerService.crawl(scanId, rootUrl, config);

  ScanModel.updateCounts(scanId, { total_pages: discoveredUrls.length });

  // Grab authenticated cookies before closing crawler
  const authCookies = crawlerService.getAuthCookies();

  // Close crawler browser before starting scanner to free memory
  await crawlerService.close();

  if (wasCancelled(scanId)) {
    logger.info('Scan aborted after crawl (cancelled)', { scanId });
    return;
  }

  // No auditable pages: fail with a clear reason instead of reporting a
  // meaningless "score 100" on an empty audit
  if (discoveredUrls.length === 0) {
    const skipped = PageModel.findByScanId(scanId).filter(p => p.status === 'skipped');
    const rootPage = skipped.find(p => p.url === normalizeUrl(rootUrl)) || skipped[0];
    let message = 'No auditable pages found: the root URL could not be crawled.';
    if (rootPage?.skip_reason) {
      message = `No auditable pages found: root URL was skipped — ${describeSkipReason(rootPage.skip_reason)}.`;
      if (rootPage.skip_reason === 'auth-gated') {
        message += ' If you have credentials, configure authentication under Advanced Options.';
      }
    }
    throw new Error(message);
  }

  // Phase 2: Scanning
  ScanModel.updateStatus(scanId, 'scanning');
  io.to(scanId).emit('scan:status', { scanId, status: 'scanning' });

  await scannerService.initialize(io);
  await scannerService.scanPages(scanId, config, authCookies.length > 0 ? authCookies : undefined);

  // Update scanned pages count
  const scannedCount = PageModel.countScannedByScanId(scanId);
  ScanModel.updateCounts(scanId, { scanned_pages: scannedCount });

  if (wasCancelled(scanId)) {
    await scannerService.close();
    logger.info('Scan aborted after scanning (cancelled)', { scanId });
    return;
  }

  // Phase 3: Analyzing (Deduplication)
  ScanModel.updateStatus(scanId, 'analyzing');
  io.to(scanId).emit('scan:status', { scanId, status: 'analyzing' });
  io.to(scanId).emit('scan:analyzing', { scanId, message: 'Running smart deduplication...' });

  await deduplicationService.analyze(scanId);

  // Calculate final score
  reportService.calculateAndUpdateScore(scanId);

  if (wasCancelled(scanId)) {
    await scannerService.close();
    logger.info('Scan aborted before completion (cancelled)', { scanId });
    return;
  }

  // Complete
  ScanModel.updateStatus(scanId, 'complete');
  const finalScan = ScanModel.findById(scanId);

  io.to(scanId).emit('scan:complete', {
    scanId,
    summary: {
      totalPages: finalScan?.total_pages,
      totalIssues: finalScan?.total_issues,
      score: finalScan?.score,
    },
  });

  // Cleanup
  await scannerService.close();

  logger.info('Scan complete', { scanId, score: finalScan?.score });
}
