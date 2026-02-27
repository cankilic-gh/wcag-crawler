import { getDatabase } from '../db/database.js';
import { nanoid } from 'nanoid';
import { PageModel } from '../models/page.model.js';
import { IssueModel, Issue } from '../models/issue.model.js';
import { logger } from '../utils/logger.js';

export interface SharedComponent {
  id: string;
  scan_id: string;
  region: string;
  fingerprint: string;
  label: string;
  page_count: number;
  issue_count: number;
  sample_html: string | null;
  page_urls: string[];
}

const REGION_LABELS: Record<string, string> = {
  header: 'Site Header',
  nav: 'Main Navigation',
  footer: 'Site Footer',
  aside: 'Sidebar',
  'repeated-element': 'Repeated Element',
  'duplicate-page': 'Duplicate Page Content',
};

export class DeduplicationService {
  private deduplicationThreshold = 0.5; // 50% of pages must share component

  setThreshold(threshold: number): void {
    this.deduplicationThreshold = threshold;
  }

  async analyze(scanId: string): Promise<SharedComponent[]> {
    logger.info('Starting deduplication analysis', { scanId });

    const pages = PageModel.findByScanId(scanId).filter(p => p.status === 'complete');
    const totalPages = pages.length;
    const minPagesForShared = Math.ceil(totalPages * this.deduplicationThreshold);

    logger.debug(`Total pages: ${totalPages}, min for shared: ${minPagesForShared}`);

    // Phase 1: Group pages by region fingerprints
    const regionFingerprints = this.groupByFingerprints(pages);

    // Phase 2: Identify shared components by region (header, nav, footer)
    const sharedComponents = this.identifySharedComponents(scanId, regionFingerprints, minPagesForShared);

    // Phase 2b: Identify shared components by repeated selectors (e.g., #search-button across pages)
    const selectorBasedComponents = this.identifySharedBySelector(scanId, minPagesForShared);
    sharedComponents.push(...selectorBasedComponents);

    // Save shared components to database
    this.saveSharedComponents(sharedComponents);

    // Phase 3: Mark issues as shared or page-specific
    await this.markSharedIssues(scanId, sharedComponents);

    // Phase 4: Identify content-duplicate pages (e.g., /faq and /faq.action)
    const duplicatePageComponents = this.identifyDuplicatePages(scanId, pages);
    if (duplicatePageComponents.length > 0) {
      this.saveSharedComponents(duplicatePageComponents);
      sharedComponents.push(...duplicatePageComponents);
    }

    // Phase 4.5: Issue-signature fallback dedup
    // Catches duplicates missed by fingerprinting (e.g., form action attr differences)
    const alreadyDeduped = new Set<string>();
    for (const sc of sharedComponents) {
      if (sc.region === 'duplicate-page') {
        for (const url of sc.page_urls) alreadyDeduped.add(url);
      }
    }
    const remainingPages = pages.filter(p => !alreadyDeduped.has(p.url));
    const issueSignatureComponents = this.identifyDuplicatesByIssueSignature(scanId, remainingPages);
    if (issueSignatureComponents.length > 0) {
      this.saveSharedComponents(issueSignatureComponents);
      sharedComponents.push(...issueSignatureComponents);
    }

    logger.info(`Deduplication complete: ${sharedComponents.length} shared components found`, { scanId });

    return sharedComponents;
  }

  private groupByFingerprints(pages: Array<{ url: string; regions_fingerprint: Record<string, string> | null }>): Map<string, Map<string, string[]>> {
    // Map<region, Map<fingerprint, urls[]>>
    const regionGroups = new Map<string, Map<string, string[]>>();

    for (const page of pages) {
      if (!page.regions_fingerprint) continue;

      for (const [region, fingerprint] of Object.entries(page.regions_fingerprint)) {
        if (!regionGroups.has(region)) {
          regionGroups.set(region, new Map());
        }

        const fingerprintMap = regionGroups.get(region)!;
        if (!fingerprintMap.has(fingerprint)) {
          fingerprintMap.set(fingerprint, []);
        }

        fingerprintMap.get(fingerprint)!.push(page.url);
      }
    }

    return regionGroups;
  }

  private identifySharedComponents(
    scanId: string,
    regionFingerprints: Map<string, Map<string, string[]>>,
    minPages: number
  ): SharedComponent[] {
    const sharedComponents: SharedComponent[] = [];

    for (const [region, fingerprintMap] of regionFingerprints) {
      for (const [fingerprint, urls] of fingerprintMap) {
        if (urls.length >= minPages) {
          sharedComponents.push({
            id: `sc_${nanoid(12)}`,
            scan_id: scanId,
            region,
            fingerprint,
            label: REGION_LABELS[region] || `Shared ${region}`,
            page_count: urls.length,
            issue_count: 0, // Will be calculated later
            sample_html: null, // Could extract from first page
            page_urls: urls,
          });
        }
      }
    }

    return sharedComponents;
  }

  /**
   * Identify shared components by repeated selectors across pages.
   * If the same selector (e.g., #search-button) has the same issue on multiple pages,
   * it's likely a shared component even if it's not in a detected region.
   */
  private identifySharedBySelector(scanId: string, minPages: number): SharedComponent[] {
    const issues = IssueModel.findByScanId(scanId);
    const sharedComponents: SharedComponent[] = [];

    // Group issues by (rule_id + selector)
    // Map<key, { issues: Issue[], pageIds: Set<string>, pageUrls: Set<string> }>
    const selectorGroups = new Map<string, {
      ruleId: string;
      selector: string;
      issues: Issue[];
      pageIds: Set<string>;
      pageUrls: Set<string>;
      sampleHtml: string | null;
    }>();

    for (const issue of issues) {
      // Skip issues already in a region-based shared component
      if (issue.is_shared_component) continue;
      // Only consider issues with specific selectors (ID or unique class selectors)
      if (!issue.target_selector) continue;

      const key = `${issue.axe_rule_id}:${issue.target_selector}`;

      if (!selectorGroups.has(key)) {
        selectorGroups.set(key, {
          ruleId: issue.axe_rule_id,
          selector: issue.target_selector,
          issues: [],
          pageIds: new Set(),
          pageUrls: new Set(),
          sampleHtml: issue.html_snippet,
        });
      }

      const group = selectorGroups.get(key)!;
      group.issues.push(issue);
      group.pageIds.add(issue.page_id);

      // Get page URL
      const page = PageModel.findById(issue.page_id);
      if (page) {
        group.pageUrls.add(page.url);
      }
    }

    // Create shared components for groups that appear on enough pages
    for (const [key, group] of selectorGroups) {
      if (group.pageIds.size >= minPages) {
        // Generate a readable label from the selector
        const label = this.generateSelectorLabel(group.selector, group.ruleId);
        const fingerprint = `selector:${key}`;

        sharedComponents.push({
          id: `sc_${nanoid(12)}`,
          scan_id: scanId,
          region: 'repeated-element',
          fingerprint,
          label,
          page_count: group.pageIds.size,
          issue_count: 1, // Each selector group is one unique issue
          sample_html: group.sampleHtml,
          page_urls: Array.from(group.pageUrls),
        });

        // Mark these issues as shared
        const issueIds = group.issues.map(i => i.id);
        const componentId = sharedComponents[sharedComponents.length - 1].id;
        IssueModel.markManyAsSharedComponent(issueIds, componentId);
      }
    }

    logger.debug(`Found ${sharedComponents.length} selector-based shared components`);
    return sharedComponents;
  }

  /**
   * Identify content-duplicate pages by comparing main region fingerprints.
   * Pages like /faq and /faq.action that serve identical content are grouped,
   * and their remaining page-specific issues are deduplicated into a shared component.
   */
  private identifyDuplicatePages(
    scanId: string,
    pages: Array<{ id: string; url: string; regions_fingerprint: Record<string, string> | null }>
  ): SharedComponent[] {
    const sharedComponents: SharedComponent[] = [];

    // Group pages by content fingerprint: prefer main, fallback to body
    const mainFingerprintGroups = new Map<string, typeof pages>();

    for (const page of pages) {
      const contentFingerprint = page.regions_fingerprint?.main || page.regions_fingerprint?.body;
      if (!contentFingerprint) continue;

      if (!mainFingerprintGroups.has(contentFingerprint)) {
        mainFingerprintGroups.set(contentFingerprint, []);
      }
      mainFingerprintGroups.get(contentFingerprint)!.push(page);
    }

    for (const [fingerprint, duplicatePages] of mainFingerprintGroups) {
      if (duplicatePages.length < 2) continue;

      const pageUrls = duplicatePages.map(p => p.url);

      // Re-fetch issues from DB to get fresh is_shared_component state (after Phase 3)
      const allIssues: Issue[] = [];
      for (const page of duplicatePages) {
        const pageIssues = IssueModel.findByPageId(page.id);
        allIssues.push(...pageIssues);
      }

      // Group non-shared issues by (rule_id, target_selector)
      const issueGroups = new Map<string, Issue[]>();
      for (const issue of allIssues) {
        if (issue.is_shared_component) continue;

        const key = `${issue.axe_rule_id}:${issue.target_selector || ''}`;
        if (!issueGroups.has(key)) {
          issueGroups.set(key, []);
        }
        issueGroups.get(key)!.push(issue);
      }

      // Mark issue groups that appear on multiple pages
      const componentId = `sc_${nanoid(12)}`;
      let markedCount = 0;

      for (const [, issues] of issueGroups) {
        const issuePageIds = new Set(issues.map(i => i.page_id));
        if (issuePageIds.size >= 2) {
          IssueModel.markManyAsSharedComponent(issues.map(i => i.id), componentId);
          markedCount++;
        }
      }

      if (markedCount > 0) {
        const shortUrls = pageUrls.map(u => {
          try { return new URL(u).pathname; } catch { return u; }
        });

        sharedComponents.push({
          id: componentId,
          scan_id: scanId,
          region: 'duplicate-page',
          fingerprint: `main:${fingerprint}`,
          label: `Duplicate Page: ${shortUrls.join(', ')}`,
          page_count: duplicatePages.length,
          issue_count: markedCount,
          sample_html: null,
          page_urls: pageUrls,
        });

        logger.debug(`Found duplicate pages: ${shortUrls.join(', ')} (${markedCount} shared issues)`);
      }
    }

    return sharedComponents;
  }

  /**
   * Phase 4.5: Fallback duplicate detection using page title + issue signature.
   * If two pages have the same title AND the exact same set of issues (rule_id + selector),
   * they are almost certainly the same page served at different URLs.
   */
  private identifyDuplicatesByIssueSignature(
    scanId: string,
    pages: Array<{ id: string; url: string; regions_fingerprint: Record<string, string> | null }>
  ): SharedComponent[] {
    const sharedComponents: SharedComponent[] = [];

    // Build issue signature per page: sorted list of (rule_id:selector)
    const pageSignatures = new Map<string, { page: typeof pages[0]; title: string; signature: string }>();

    for (const page of pages) {
      const fullPage = PageModel.findById(page.id);
      if (!fullPage?.title) continue;

      const issues = IssueModel.findByPageId(page.id);
      if (issues.length === 0) continue;

      const sigParts = issues
        .filter(i => !i.is_shared_component)
        .map(i => `${i.axe_rule_id}:${i.target_selector || ''}`)
        .sort();

      if (sigParts.length === 0) continue;

      const signature = sigParts.join('|');
      const groupKey = `${fullPage.title}::${signature}`;

      pageSignatures.set(page.id, { page, title: fullPage.title, signature: groupKey });
    }

    // Group by title + issue signature
    const signatureGroups = new Map<string, Array<{ page: typeof pages[0]; title: string }>>();
    for (const [, entry] of pageSignatures) {
      if (!signatureGroups.has(entry.signature)) {
        signatureGroups.set(entry.signature, []);
      }
      signatureGroups.get(entry.signature)!.push({ page: entry.page, title: entry.title });
    }

    for (const [, group] of signatureGroups) {
      if (group.length < 2) continue;

      const duplicatePages = group.map(g => g.page);
      const pageUrls = duplicatePages.map(p => p.url);

      const allIssues: Issue[] = [];
      for (const page of duplicatePages) {
        const pageIssues = IssueModel.findByPageId(page.id);
        allIssues.push(...pageIssues);
      }

      const issueGroups = new Map<string, Issue[]>();
      for (const issue of allIssues) {
        if (issue.is_shared_component) continue;
        const key = `${issue.axe_rule_id}:${issue.target_selector || ''}`;
        if (!issueGroups.has(key)) {
          issueGroups.set(key, []);
        }
        issueGroups.get(key)!.push(issue);
      }

      const componentId = `sc_${nanoid(12)}`;
      let markedCount = 0;

      for (const [, issues] of issueGroups) {
        const issuePageIds = new Set(issues.map(i => i.page_id));
        if (issuePageIds.size >= 2) {
          IssueModel.markManyAsSharedComponent(issues.map(i => i.id), componentId);
          markedCount++;
        }
      }

      if (markedCount > 0) {
        const shortUrls = pageUrls.map(u => {
          try { return new URL(u).pathname; } catch { return u; }
        });

        sharedComponents.push({
          id: componentId,
          scan_id: scanId,
          region: 'duplicate-page',
          fingerprint: `issue-sig:${shortUrls.join('+')}`,
          label: `Duplicate Page: ${shortUrls.join(', ')}`,
          page_count: duplicatePages.length,
          issue_count: markedCount,
          sample_html: null,
          page_urls: pageUrls,
        });

        logger.debug(`Found duplicate pages by issue signature: ${shortUrls.join(', ')} (${markedCount} shared issues)`);
      }
    }

    return sharedComponents;
  }

  /**
   * Generate a human-readable label from a selector
   */
  private generateSelectorLabel(selector: string, ruleId: string): string {
    // Try to extract meaningful info from selector
    const idMatch = selector.match(/#([\w-]+)/);
    const classMatch = selector.match(/\.([\w-]+)/);
    const tagMatch = selector.match(/^(\w+)/);

    let elementName = 'Element';
    if (idMatch) {
      // Convert ID to readable: button-addon2 -> "Button Addon 2"
      elementName = idMatch[1]
        .replace(/[-_]/g, ' ')
        .replace(/(\d+)/g, ' $1')
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
        .trim();
    } else if (classMatch) {
      elementName = classMatch[1]
        .replace(/[-_]/g, ' ')
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
        .trim();
    } else if (tagMatch) {
      elementName = tagMatch[1].charAt(0).toUpperCase() + tagMatch[1].slice(1);
    }

    return `Repeated: ${elementName}`;
  }

  private saveSharedComponents(components: SharedComponent[]): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO shared_components (id, scan_id, region, fingerprint, label, page_count, issue_count, sample_html, page_urls)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((items: SharedComponent[]) => {
      for (const component of items) {
        stmt.run(
          component.id,
          component.scan_id,
          component.region,
          component.fingerprint,
          component.label,
          component.page_count,
          component.issue_count,
          component.sample_html,
          JSON.stringify(component.page_urls)
        );
      }
    });

    insertMany(components);
  }

  private async markSharedIssues(scanId: string, sharedComponents: SharedComponent[]): Promise<void> {
    const db = getDatabase();

    // Create a map of fingerprint -> component for quick lookup
    const fingerprintToComponent = new Map<string, SharedComponent>();
    for (const component of sharedComponents) {
      fingerprintToComponent.set(`${component.region}:${component.fingerprint}`, component);
    }

    // Get all issues for this scan
    const issues = IssueModel.findByScanId(scanId);

    // Group issues by component
    const componentIssues = new Map<string, Issue[]>();

    for (const issue of issues) {
      if (!issue.dom_region || !issue.region_fingerprint) continue;

      const key = `${issue.dom_region}:${issue.region_fingerprint}`;
      const component = fingerprintToComponent.get(key);

      if (component) {
        if (!componentIssues.has(component.id)) {
          componentIssues.set(component.id, []);
        }
        componentIssues.get(component.id)!.push(issue);
      }
    }

    // Deduplicate issues within each component and mark them
    for (const [componentId, compIssues] of componentIssues) {
      // Group by (rule_id + target_selector) to find duplicates
      const uniqueIssues = new Map<string, Issue[]>();

      for (const issue of compIssues) {
        const key = `${issue.axe_rule_id}:${issue.target_selector || ''}`;
        if (!uniqueIssues.has(key)) {
          uniqueIssues.set(key, []);
        }
        uniqueIssues.get(key)!.push(issue);
      }

      // Mark all issues in each group as shared
      for (const issueGroup of uniqueIssues.values()) {
        const issueIds = issueGroup.map(i => i.id);
        IssueModel.markManyAsSharedComponent(issueIds, componentId);
      }

      // Update component issue count (unique issues only)
      const stmt = db.prepare('UPDATE shared_components SET issue_count = ? WHERE id = ?');
      stmt.run(uniqueIssues.size, componentId);
    }
  }

  getSharedComponents(scanId: string): SharedComponent[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM shared_components WHERE scan_id = ?');
    const rows = stmt.all(scanId) as Record<string, unknown>[];

    return rows.map(row => ({
      ...row,
      page_urls: JSON.parse(row.page_urls as string),
    })) as SharedComponent[];
  }
}

export const deduplicationService = new DeduplicationService();
