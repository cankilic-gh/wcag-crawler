import { getDatabase } from '../db/database.js';
import { nanoid } from 'nanoid';
import { redactCredentialText, redactScanConfig, redactUrlCredentials } from '../entitlements/redaction.js';
import type { ScanAccessRecord } from '../auth/scan-access.js';

export type WcagVersion = '2.1' | '2.2';

export type EntitlementTier = 'anonymous' | 'user' | 'admin';

export interface ScanConfig {
  /** Page-count cap. `null` means unlimited (admin tier only). */
  maxPages: number | null;
  maxDepth: number;
  concurrency: number;
  delay: number;
  excludePatterns: string[];
  waitForSelector: string | null;
  respectRobotsTxt: boolean;
  viewport: { width: number; height: number };
  authentication: { authType: 'form' | 'basic'; loginUrl: string; username: string; password: string } | null;
  wcagVersion: WcagVersion;
  /** Effective entitlement tier this scan ran under. Persisted in the JSON config (no schema migration). */
  entitlementTier?: EntitlementTier;
}

export interface Scan {
  id: string;
  root_url: string;
  status: 'pending' | 'crawling' | 'scanning' | 'analyzing' | 'complete' | 'failed';
  config: ScanConfig;
  total_pages: number;
  scanned_pages: number;
  total_issues: number;
  critical_count: number;
  serious_count: number;
  moderate_count: number;
  minor_count: number;
  score: number | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ScanOwnershipInput {
  ownerGoogleSub: string | null;
  accessTokenHash: string | null;
}

function parsePersistedConfig(value: unknown): ScanConfig {
  if (typeof value !== 'string') return {} as ScanConfig;
  try {
    return redactScanConfig(JSON.parse(value));
  } catch {
    return {} as ScanConfig;
  }
}

function toPublicScan(row: Record<string, unknown>): Scan {
  const { owner_google_sub: _owner, access_token_hash: _capability, ...publicRow } = row;
  return {
    ...publicRow,
    root_url: redactUrlCredentials(row.root_url as string),
    config: parsePersistedConfig(row.config),
    error_message: typeof row.error_message === 'string' ? redactCredentialText(row.error_message) : null,
  } as Scan;
}

export const ScanModel = {
  create(
    rootUrl: string,
    config: ScanConfig,
    ownership: ScanOwnershipInput = { ownerGoogleSub: null, accessTokenHash: null },
  ): Scan {
    const db = getDatabase();
    const id = `scan_${nanoid(12)}`;
    const persistedConfig = redactScanConfig(config);
    const persistedRootUrl = redactUrlCredentials(rootUrl);
    // The runner receives the full config in-memory, but plaintext credentials
    // and URL userinfo must never touch the database.
    const stmt = db.prepare(`
      INSERT INTO scans (id, root_url, status, config, owner_google_sub, access_token_hash)
      VALUES (?, ?, 'pending', ?, ?, ?)
    `);
    stmt.run(
      id,
      persistedRootUrl,
      JSON.stringify(persistedConfig),
      ownership.ownerGoogleSub,
      ownership.accessTokenHash,
    );
    return this.findById(id)!;
  },

  findById(id: string): Scan | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM scans WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return toPublicScan(row);
  },

  findAll(limit = 50, offset = 0): Scan[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM scans ORDER BY created_at DESC LIMIT ? OFFSET ?');
    const rows = stmt.all(limit, offset) as Record<string, unknown>[];
    return rows.map(toPublicScan);
  },

  findAllByOwner(googleSub: string, limit = 50, offset = 0): Scan[] {
    const rows = getDatabase().prepare(`
      SELECT * FROM scans
      WHERE owner_google_sub = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(googleSub, limit, offset) as Record<string, unknown>[];
    return rows.map(toPublicScan);
  },

  findAccessById(id: string): ScanAccessRecord | null {
    const row = getDatabase().prepare(`
      SELECT owner_google_sub, access_token_hash FROM scans WHERE id = ?
    `).get(id) as { owner_google_sub: string | null; access_token_hash: string | null } | undefined;
    if (!row) return null;
    return {
      ownerGoogleSub: row.owner_google_sub,
      accessTokenHash: row.access_token_hash,
    };
  },

  updateStatus(id: string, status: Scan['status'], errorMessage?: string): void {
    const db = getDatabase();
    const updates: Record<string, unknown> = { status };
    if (status === 'crawling') {
      updates.started_at = new Date().toISOString();
    } else if (status === 'complete' || status === 'failed') {
      updates.completed_at = new Date().toISOString();
    }
    if (errorMessage !== undefined) {
      updates.error_message = redactCredentialText(errorMessage);
    }
    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const stmt = db.prepare(`UPDATE scans SET ${setClauses} WHERE id = ?`);
    stmt.run(...Object.values(updates), id);
  },

  updateCounts(id: string, counts: Partial<Pick<Scan, 'total_pages' | 'scanned_pages' | 'total_issues' | 'critical_count' | 'serious_count' | 'moderate_count' | 'minor_count' | 'score'>>): void {
    const db = getDatabase();
    const setClauses = Object.keys(counts).map(k => `${k} = ?`).join(', ');
    const stmt = db.prepare(`UPDATE scans SET ${setClauses} WHERE id = ?`);
    stmt.run(...Object.values(counts), id);
  },

  delete(id: string): void {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM scans WHERE id = ?');
    stmt.run(id);
  },
};
