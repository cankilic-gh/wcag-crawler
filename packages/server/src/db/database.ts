import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { ScanConfig } from '../models/scan.model.js';
import {
  configHasStoredCredentials,
  redactCredentialText,
  redactScanConfig,
  redactUrlCredentials,
} from '../entitlements/redaction.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = process.env.DATABASE_PATH || join(__dirname, '../../data/a11y-crawler.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function ensureColumn(table: string, column: string, definition: string): void {
  const database = getDatabase();
  const columns = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some(existing => existing.name === column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function runAuthOwnershipMigrations(): void {
  const database = getDatabase();
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      google_sub TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      name TEXT,
      picture_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  ensureColumn('scans', 'owner_google_sub', 'TEXT REFERENCES users(google_sub) ON DELETE SET NULL');
  ensureColumn('scans', 'access_token_hash', 'TEXT');
  database.exec('CREATE INDEX IF NOT EXISTS idx_scans_owner ON scans(owner_google_sub, created_at DESC)');
}

export function initializeDatabase(): void {
  const database = getDatabase();
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  database.exec(schema);
  runAuthOwnershipMigrations();

  // Legacy columns must exist before credential cleanup reads them.
  const cols = database.prepare("PRAGMA table_info(pages)").all() as Array<{ name: string }>;
  if (!cols.some(c => c.name === 'source_url')) {
    database.exec('ALTER TABLE pages ADD COLUMN source_url TEXT');
  }

  // Migration: add error_message column if missing (existing DBs)
  const scanCols = database.prepare("PRAGMA table_info(scans)").all() as Array<{ name: string }>;
  if (!scanCols.some(c => c.name === 'error_message')) {
    database.exec('ALTER TABLE scans ADD COLUMN error_message TEXT');
  }

  // Migration: add skip_reason column if missing (existing DBs)
  if (!cols.some(c => c.name === 'skip_reason')) {
    database.exec('ALTER TABLE pages ADD COLUMN skip_reason TEXT');
  }

  // Defense in depth: scrub any plaintext credentials left in legacy rows.
  cleanupLegacyCredentials();

  console.log('Database initialized successfully');
}

/**
 * Idempotently strip plaintext authentication credentials from persisted scan
 * configs. Newer scans are already redacted at write time (ScanModel.create),
 * but a database created before that guarantee may still hold plaintext. Safe
 * to run repeatedly: once redacted, credentials are empty and rows are skipped.
 */
export function cleanupLegacyCredentials(): void {
  const database = getDatabase();
  const rows = database.prepare(`
    SELECT id, root_url, config, error_message
    FROM scans
  `).all() as Array<{ id: string; root_url: string; config: string; error_message: string | null }>;
  const update = database.prepare('UPDATE scans SET root_url = ?, config = ?, error_message = ? WHERE id = ?');
  let cleaned = 0;
  for (const row of rows) {
    let config: ScanConfig | null = null;
    let configJson = row.config;
    try {
      const parsed = JSON.parse(row.config) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        config = parsed as ScanConfig;
      } else {
        configJson = '{}';
      }
    } catch {
      configJson = '{}';
    }

    const rootUrl = redactUrlCredentials(row.root_url);
    const errorMessage = row.error_message ? redactCredentialText(row.error_message) : null;
    if (configHasStoredCredentials(config)) {
      configJson = JSON.stringify(redactScanConfig(config!));
    }

    if (rootUrl !== row.root_url || configJson !== row.config || errorMessage !== row.error_message) {
      update.run(rootUrl, configJson, errorMessage, row.id);
      cleaned++;
    }
  }

  const pageRows = database.prepare(`
    SELECT id, url, source_url
    FROM pages
    WHERE url LIKE '%@%' OR url LIKE '%?%'
       OR source_url LIKE '%@%' OR source_url LIKE '%?%'
  `).all() as Array<{ id: string; url: string; source_url: string | null }>;
  const updatePage = database.prepare('UPDATE pages SET url = ?, source_url = ? WHERE id = ?');
  for (const row of pageRows) {
    const url = redactUrlCredentials(row.url);
    const sourceUrl = row.source_url ? redactUrlCredentials(row.source_url) : null;
    if (url !== row.url || sourceUrl !== row.source_url) {
      updatePage.run(url, sourceUrl, row.id);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`Redacted legacy credentials in ${cleaned} stored record(s)`);
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
