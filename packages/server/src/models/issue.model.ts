import { getDatabase } from '../db/database.js';
import { nanoid } from 'nanoid';

export interface Issue {
  id: string;
  scan_id: string;
  page_id: string;
  axe_rule_id: string;
  description: string;
  help: string | null;
  help_url: string | null;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  wcag_tags: string[];
  target_selector: string | null;
  html_snippet: string | null;
  dom_region: string | null;
  region_fingerprint: string | null;
  failure_summary: string | null;
  is_shared_component: boolean;
  shared_component_group: string | null;
  created_at: string;
}

export interface IssueCreate {
  scan_id: string;
  page_id: string;
  axe_rule_id: string;
  description: string;
  help?: string;
  help_url?: string;
  impact: Issue['impact'];
  wcag_tags: string[];
  target_selector?: string;
  html_snippet?: string;
  dom_region?: string;
  region_fingerprint?: string;
  failure_summary?: string;
}

export const IssueModel = {
  create(data: IssueCreate): Issue {
    const db = getDatabase();
    const id = `issue_${nanoid(12)}`;
    const stmt = db.prepare(`
      INSERT INTO issues (
        id, scan_id, page_id, axe_rule_id, description, help, help_url,
        impact, wcag_tags, target_selector, html_snippet, dom_region,
        region_fingerprint, failure_summary
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      data.scan_id,
      data.page_id,
      data.axe_rule_id,
      data.description,
      data.help || null,
      data.help_url || null,
      data.impact,
      JSON.stringify(data.wcag_tags),
      data.target_selector || null,
      data.html_snippet || null,
      data.dom_region || null,
      data.region_fingerprint || null,
      data.failure_summary || null
    );
    return this.findById(id)!;
  },

  createMany(issues: IssueCreate[]): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO issues (
        id, scan_id, page_id, axe_rule_id, description, help, help_url,
        impact, wcag_tags, target_selector, html_snippet, dom_region,
        region_fingerprint, failure_summary
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((items: IssueCreate[]) => {
      for (const data of items) {
        const id = `issue_${nanoid(12)}`;
        stmt.run(
          id,
          data.scan_id,
          data.page_id,
          data.axe_rule_id,
          data.description,
          data.help || null,
          data.help_url || null,
          data.impact,
          JSON.stringify(data.wcag_tags),
          data.target_selector || null,
          data.html_snippet || null,
          data.dom_region || null,
          data.region_fingerprint || null,
          data.failure_summary || null
        );
      }
    });

    insertMany(issues);
  },

  findById(id: string): Issue | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM issues WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      ...row,
      wcag_tags: JSON.parse(row.wcag_tags as string),
      is_shared_component: Boolean(row.is_shared_component),
    } as Issue;
  },

  findByScanId(scanId: string): Issue[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM issues WHERE scan_id = ?');
    const rows = stmt.all(scanId) as Record<string, unknown>[];
    return rows.map(row => ({
      ...row,
      wcag_tags: JSON.parse(row.wcag_tags as string),
      is_shared_component: Boolean(row.is_shared_component),
    })) as Issue[];
  },

  findByPageId(pageId: string): Issue[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM issues WHERE page_id = ?');
    const rows = stmt.all(pageId) as Record<string, unknown>[];
    return rows.map(row => ({
      ...row,
      wcag_tags: JSON.parse(row.wcag_tags as string),
      is_shared_component: Boolean(row.is_shared_component),
    })) as Issue[];
  },

  countByScanId(scanId: string): { total: number; critical: number; serious: number; moderate: number; minor: number } {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN impact = 'critical' THEN 1 ELSE 0 END) as critical,
        SUM(CASE WHEN impact = 'serious' THEN 1 ELSE 0 END) as serious,
        SUM(CASE WHEN impact = 'moderate' THEN 1 ELSE 0 END) as moderate,
        SUM(CASE WHEN impact = 'minor' THEN 1 ELSE 0 END) as minor
      FROM issues WHERE scan_id = ?
    `);
    const row = stmt.get(scanId) as Record<string, number>;
    return {
      total: row.total || 0,
      critical: row.critical || 0,
      serious: row.serious || 0,
      moderate: row.moderate || 0,
      minor: row.minor || 0,
    };
  },

  markAsSharedComponent(issueId: string, componentGroupId: string): void {
    const db = getDatabase();
    const stmt = db.prepare('UPDATE issues SET is_shared_component = TRUE, shared_component_group = ? WHERE id = ?');
    stmt.run(componentGroupId, issueId);
  },

  markManyAsSharedComponent(issueIds: string[], componentGroupId: string): void {
    const db = getDatabase();
    const placeholders = issueIds.map(() => '?').join(',');
    const stmt = db.prepare(`UPDATE issues SET is_shared_component = TRUE, shared_component_group = ? WHERE id IN (${placeholders})`);
    stmt.run(componentGroupId, ...issueIds);
  },
};
