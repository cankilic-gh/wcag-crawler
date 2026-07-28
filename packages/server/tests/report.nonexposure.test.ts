/**
 * End-to-end credential non-exposure over HTTP.
 *
 * A legacy scan row is inserted with PLAINTEXT credentials (bypassing
 * ScanModel.create's write-time redaction) and left un-cleaned, so the only
 * thing protecting the API is read-time redaction. We then hit the real
 * GET /api/scans/:id and GET /api/reports/:scanId routes (no browser needed —
 * the report is generated from empty pages/issues) and assert that neither the
 * username nor the password appears in either response body.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import type { Server as SocketServer } from 'socket.io';

process.env.DATABASE_PATH = ':memory:';

const { initializeDatabase, getDatabase } = await import('../src/db/database.js');
const { createScanRoutes } = await import('../src/routes/scan.routes.js');
const { createReportRoutes } = await import('../src/routes/report.routes.js');
const { createOptionalAuthMiddleware } = await import('../src/auth/middleware.js');

const ioStub = { to: () => ({ emit: () => {} }) } as unknown as SocketServer;
const noopRunner = async () => {};

const LEGACY_USER = 'legacy-user-fixture';
const LEGACY_PASS = 'legacy-pass-PLAINTEXT-FIXTURE';
const ADMIN_EMAIL = 'cankilic.mail@gmail.com';
const ADMIN_TOKEN = 'verified-admin-fixture';

function legacyConfigJson(): string {
  return JSON.stringify({
    maxPages: 50, maxDepth: 3, concurrency: 3, delay: 500, excludePatterns: [],
    waitForSelector: null, respectRobotsTxt: true, viewport: { width: 1280, height: 720 },
    authentication: {
      authType: 'form', loginUrl: 'https://example.com/login',
      username: LEGACY_USER, password: LEGACY_PASS,
    },
    wcagVersion: '2.1', entitlementTier: 'quick',
  });
}

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(createOptionalAuthMiddleware({
    adminEmails: [ADMIN_EMAIL],
    verifier: {
      async verify(token) {
        if (token !== ADMIN_TOKEN) throw new Error('invalid fixture token');
        return {
          sub: 'admin-sub', email: ADMIN_EMAIL, emailVerified: true,
          name: 'Can', pictureUrl: null,
        };
      },
    },
  }));
  app.use('/api/scans', createScanRoutes(ioStub, { runner: noopRunner }));
  app.use('/api/reports', createReportRoutes());
  return app;
}

function adminGet(app: Express, path: string) {
  return request(app).get(path).set('Authorization', `Bearer ${ADMIN_TOKEN}`);
}

beforeAll(() => {
  initializeDatabase();
});

beforeEach(() => {
  const db = getDatabase();
  db.exec('DELETE FROM scans');
  // Insert AFTER initializeDatabase's cleanup so only read-time redaction defends.
  db.prepare(
    "INSERT INTO scans (id, root_url, status, config) VALUES (?, ?, 'complete', ?)",
  ).run('scan_leak', 'https://example.com', legacyConfigJson());
});

describe('credential non-exposure over HTTP', () => {
  it('keeps a plaintext DB row but never returns credentials via GET /api/scans/:id', async () => {
    const app = buildApp();

    // Precondition: the raw row genuinely holds plaintext (proves the API redacts).
    const raw = getDatabase().prepare('SELECT config FROM scans WHERE id = ?').get('scan_leak') as { config: string };
    expect(raw.config).toContain(LEGACY_PASS);

    const res = await adminGet(app, '/api/scans/scan_leak');
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain(LEGACY_USER);
    expect(body).not.toContain(LEGACY_PASS);
    expect(res.body.config).toEqual({});
  });

  it('never returns credentials via GET /api/reports/:scanId', async () => {
    const app = buildApp();

    const res = await adminGet(app, '/api/reports/scan_leak');
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain(LEGACY_USER);
    expect(body).not.toContain(LEGACY_PASS);
    // The report embeds the scan; its config must be redacted too.
    expect(res.body.scan.config).toEqual({});
  });

  it.each([
    '/api/scans',
    '/api/reports/scan_leak/export?format=html',
    '/api/reports/scan_leak/fix-report',
  ])('never returns credentials via %s', async (path) => {
    const app = buildApp();

    const res = await adminGet(app, path);

    expect(res.status).toBe(200);
    const body = typeof res.text === 'string' ? res.text : JSON.stringify(res.body);
    expect(body).not.toContain(LEGACY_USER);
    expect(body).not.toContain(LEGACY_PASS);
  });
});
