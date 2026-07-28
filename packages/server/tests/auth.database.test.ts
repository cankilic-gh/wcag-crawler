import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ScanConfig } from '../src/models/scan.model.js';

process.env.DATABASE_PATH = ':memory:';

const { getDatabase, initializeDatabase } = await import('../src/db/database.js');
const { UserModel } = await import('../src/models/user.model.js');
const { ScanModel } = await import('../src/models/scan.model.js');

const CONFIG: ScanConfig = {
  maxPages: 10,
  maxDepth: 2,
  concurrency: 1,
  delay: 500,
  excludePatterns: [],
  waitForSelector: null,
  respectRobotsTxt: true,
  viewport: { width: 1280, height: 720 },
  authentication: null,
  wcagVersion: '2.1',
  entitlementTier: 'anonymous',
};

beforeAll(() => initializeDatabase());

beforeEach(() => {
  getDatabase().exec('DELETE FROM pages; DELETE FROM scans; DELETE FROM users');
});

describe('auth ownership migration', () => {
  it('creates users and idempotently adds scan ownership columns', () => {
    expect(() => initializeDatabase()).not.toThrow();
    expect(() => initializeDatabase()).not.toThrow();

    const db = getDatabase();
    const userTable = db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'",
    ).get();
    const scanColumns = db.prepare('PRAGMA table_info(scans)').all() as Array<{ name: string }>;

    expect(userTable).toBeTruthy();
    expect(scanColumns.map(column => column.name)).toEqual(expect.arrayContaining([
      'owner_google_sub',
      'access_token_hash',
    ]));
  });
});

describe('UserModel', () => {
  it('upserts by immutable Google sub and refreshes profile fields', () => {
    const first = UserModel.upsertGoogleIdentity({
      sub: 'google-sub-1',
      email: 'first@example.com',
      emailVerified: true,
      name: 'First Name',
      pictureUrl: null,
    });
    const second = UserModel.upsertGoogleIdentity({
      sub: 'google-sub-1',
      email: 'updated@example.com',
      emailVerified: true,
      name: 'Updated Name',
      pictureUrl: 'https://example.com/avatar.png',
    });

    expect(second.googleSub).toBe(first.googleSub);
    expect(second.email).toBe('updated@example.com');
    expect(second.name).toBe('Updated Name');
    expect(UserModel.findByGoogleSub('google-sub-1')).toMatchObject(second);
    const count = getDatabase().prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
    expect(count.n).toBe(1);
  });
});

describe('ScanModel ownership persistence', () => {
  it('persists an authenticated owner without exposing ownership internals publicly', () => {
    UserModel.upsertGoogleIdentity({
      sub: 'owner-sub', email: 'owner@example.com', emailVerified: true,
      name: null, pictureUrl: null,
    });

    const scan = ScanModel.create('https://example.com', CONFIG, {
      ownerGoogleSub: 'owner-sub',
      accessTokenHash: null,
    });
    const raw = getDatabase().prepare(
      'SELECT owner_google_sub, access_token_hash FROM scans WHERE id = ?',
    ).get(scan.id) as { owner_google_sub: string | null; access_token_hash: string | null };

    expect(raw).toEqual({ owner_google_sub: 'owner-sub', access_token_hash: null });
    expect(JSON.stringify(scan)).not.toContain('owner-sub');
    expect(JSON.stringify(scan)).not.toContain('access_token_hash');
    expect(ScanModel.findAccessById(scan.id)).toEqual({
      ownerGoogleSub: 'owner-sub', accessTokenHash: null,
    });
  });

  it('persists only an anonymous capability hash and never returns it publicly', () => {
    const capabilityHash = 'a'.repeat(64);
    const scan = ScanModel.create('https://example.com', CONFIG, {
      ownerGoogleSub: null,
      accessTokenHash: capabilityHash,
    });

    expect(ScanModel.findAccessById(scan.id)).toEqual({
      ownerGoogleSub: null, accessTokenHash: capabilityHash,
    });
    expect(JSON.stringify(scan)).not.toContain(capabilityHash);
  });

  it('treats pre-ownership legacy rows as ownerless and capability-less', () => {
    const db = getDatabase();
    db.prepare(
      "INSERT INTO scans (id, root_url, status, config) VALUES (?, ?, 'complete', ?)",
    ).run('legacy-scan', 'https://legacy.example.com', JSON.stringify(CONFIG));

    expect(ScanModel.findAccessById('legacy-scan')).toEqual({
      ownerGoogleSub: null, accessTokenHash: null,
    });
  });
});
