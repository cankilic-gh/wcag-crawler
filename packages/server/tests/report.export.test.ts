import { describe, expect, it } from 'vitest';
import { generateExportHtml } from '../src/routes/report.routes.js';
import type { FullReport } from '../src/services/report.service.js';

// Minimal report fixture — enough for the HTML exporter to render.
function makeReport(): FullReport {
  return {
    scan: {
      id: 'scan_test',
      root_url: 'https://example.com',
      status: 'complete',
      total_pages: 2,
    } as FullReport['scan'],
    summary: {
      score: 82,
      totalPages: 2,
      totalIssuesRaw: 5,
      totalIssuesDeduplicated: 3,
      totalRuleTypes: 2,
      bySeverity: { critical: 0, serious: 1, moderate: 2, minor: 2 },
      ruleCountBySeverity: { critical: 0, serious: 1, moderate: 1, minor: 1 },
      topRules: [],
    },
    sharedComponents: [],
    pageSpecificIssues: [],
    skippedPages: [],
  };
}

describe('exported HTML report limitations', () => {
  it('states automated-testing limitations near Evaluation Methods', () => {
    const html = generateExportHtml(makeReport());

    // Renders the report shell.
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Evaluation Methods');

    // Accurate limitation language must be present.
    expect(html).toContain('does not certify');
    expect(html).toContain('Section 508');
    expect(html).toMatch(/European Accessibility Act|EAA/);
    expect(html).toMatch(/manual (evaluation|testing|review)/i);
    expect(html).toMatch(/programmatically identifiable|subset/i);
  });

  it('does not overstate coverage as full compliance', () => {
    const html = generateExportHtml(makeReport());

    expect(html).not.toMatch(/full\s+WCAG[^<]*compliance/i);
    expect(html).not.toMatch(/certifies\s+(WCAG|compliance)/i);
    expect(html).not.toMatch(/guarantees?\s+compliance/i);
  });
});
