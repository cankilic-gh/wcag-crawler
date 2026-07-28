/**
 * Route-level entitlement + credential-redaction tests.
 *
 * These exercise POST /api/scans through an injected fake runner, so no
 * Playwright browser is launched. A real in-memory SQLite DB backs ScanModel.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import type { Server as SocketServer } from 'socket.io';
import type { ScanConfig } from '../src/models/scan.model.js';
import { ADMIN_POLICY, QUICK_POLICY, type EntitlementResolver } from '../src/entitlements/policy.js';

// In-memory DB before any getDatabase() call.
process.env.DATABASE_PATH = ':memory:';

const { initializeDatabase, getDatabase } = await import('../src/db/database.js');
const { ScanModel } = await import('../src/models/scan.model.js');
const { createScanRoutes } = await import('../src/routes/scan.routes.js');

// Socket.IO stub — the injected runner never emits, so this is inert.
const ioStub = { to: () => ({ emit: () => {} }) } as unknown as SocketServer;

// Obviously-fake credentials (never a real secret) used only to prove the
// runner receives them while the DB/API never returns them.
const FAKE_USERNAME = 'fixture-user';
const FAKE_PASSWORD = 'fixture-pass-DO-NOT-PERSIST';

let capturedConfig: ScanConfig | undefined;

function buildApp(resolver?: EntitlementResolver): Express {
  const app = express();
  app.use(express.json());
  const runner = async (_id: string, _url: string, config: ScanConfig) => {
    capturedConfig = config;
  };
  app.use('/api/scans', createScanRoutes(ioStub, { runner, resolver }));
  return app;
}

// A tier that forbids authenticated scans (models a future policy).
const noAuthResolver: EntitlementResolver = () => ({ ...QUICK_POLICY, allowAuthentication: false });
const credentialResolver: EntitlementResolver = () => ({
  ...ADMIN_POLICY,
  maxPages: 50,
  maxDepth: 3,
});

beforeAll(() => {
  initializeDatabase();
});

beforeEach(() => {
  capturedConfig = undefined;
  getDatabase().exec('DELETE FROM scans');
});

describe('POST /api/scans entitlement enforcement', () => {
  it('returns 201 with disclosed effective config, clamps the runner config, and redacts persisted credentials', async () => {
    const app = buildApp(credentialResolver);

    const res = await request(app)
      .post('/api/scans')
      .send({
        url: 'https://example.com',
        capabilityProtocol: 1,
        config: {
          maxPages: 100,
          maxDepth: 5,
          concurrency: 5,
          authentication: {
            authType: 'form',
            loginUrl: 'https://example.com/login',
            username: FAKE_USERNAME,
            password: FAKE_PASSWORD,
          },
        },
      });

    expect(res.status).toBe(201);

    // Metadata discloses tier + every clamp.
    expect(res.body.entitlement.tier).toBe('admin');
    const byField = Object.fromEntries(
      res.body.entitlement.adjustments.map((a: { field: string }) => [a.field, a]),
    );
    expect(byField.maxPages).toMatchObject({ requested: 100, applied: 50, limit: 50 });
    expect(byField.maxDepth).toMatchObject({ requested: 5, applied: 3, limit: 3 });
    expect(byField.concurrency).toMatchObject({ requested: 5, applied: 3, limit: 3 });

    // Effective config disclosed and clamped.
    expect(res.body.effectiveConfig.maxPages).toBe(50);
    expect(res.body.effectiveConfig.maxDepth).toBe(3);
    expect(res.body.effectiveConfig.concurrency).toBe(3);
    expect(res.body.effectiveConfig.entitlementTier).toBe('admin');

    // The runner receives the CLAMPED config WITH the live credentials.
    expect(capturedConfig?.maxPages).toBe(50);
    expect(capturedConfig?.maxDepth).toBe(3);
    expect(capturedConfig?.concurrency).toBe(3);
    expect(capturedConfig?.authentication?.username).toBe(FAKE_USERNAME);
    expect(capturedConfig?.authentication?.password).toBe(FAKE_PASSWORD);

    // The HTTP response never leaks the credentials.
    expect(JSON.stringify(res.body)).not.toContain(FAKE_PASSWORD);
    expect(JSON.stringify(res.body)).not.toContain(FAKE_USERNAME);
    expect(res.body.effectiveConfig.authentication.username).toBe('');
    expect(res.body.effectiveConfig.authentication.password).toBe('');

    // Persistence is redacted (and defense-in-depth read redaction too).
    const stored = ScanModel.findById(res.body.id);
    expect(stored?.config.authentication?.username).toBe('');
    expect(stored?.config.authentication?.password).toBe('');
    expect(stored?.config.entitlementTier).toBe('admin');

    // Raw DB row must not contain the plaintext credentials either.
    const raw = getDatabase()
      .prepare('SELECT config FROM scans WHERE id = ?')
      .get(res.body.id) as { config: string };
    expect(raw.config).not.toContain(FAKE_PASSWORD);
    expect(raw.config).not.toContain(FAKE_USERNAME);
  });

  it('denies an authenticated scan with 403 under a no-auth policy and writes nothing to the DB', async () => {
    const app = buildApp(noAuthResolver);

    const res = await request(app)
      .post('/api/scans')
      .send({
        url: 'https://example.com',
        capabilityProtocol: 1,
        config: {
          authentication: {
            authType: 'form',
            loginUrl: 'https://example.com/login',
            username: FAKE_USERNAME,
            password: FAKE_PASSWORD,
          },
        },
      });

    expect(res.status).toBe(403);
    expect(res.body.tier).toBe('anonymous');
    expect(res.body.code).toBe('authentication_not_entitled');
    expect(JSON.stringify(res.body)).not.toContain(FAKE_USERNAME);
    expect(JSON.stringify(res.body)).not.toContain(FAKE_PASSWORD);

    // No scan record was created, and the runner never ran.
    expect(capturedConfig).toBeUndefined();
    const count = getDatabase().prepare('SELECT COUNT(*) AS n FROM scans').get() as { n: number };
    expect(count.n).toBe(0);
  });

  it('still allows an anonymous (no-auth) scan under the same no-auth policy', async () => {
    const app = buildApp(noAuthResolver);

    const res = await request(app)
      .post('/api/scans')
      .send({ url: 'https://example.com', capabilityProtocol: 1, config: { maxPages: 10 } });

    expect(res.status).toBe(201);
    expect(capturedConfig?.maxPages).toBe(10);
  });

  it.each([
    {
      label: 'root URL',
      body: { url: 'https://embedded-user:embedded-pass@example.com' },
    },
    {
      label: 'authentication login URL',
      body: {
        url: 'https://example.com',
        config: {
          authentication: {
            authType: 'form',
            loginUrl: 'https://embedded-user:embedded-pass@example.com/login',
            username: FAKE_USERNAME,
            password: FAKE_PASSWORD,
          },
        },
      },
    },
    {
      label: 'root URL query string',
      body: { url: 'https://example.com?access_token=embedded-query-secret' },
    },
    {
      label: 'authentication login URL query string',
      body: {
        url: 'https://example.com',
        config: {
          authentication: {
            authType: 'form',
            loginUrl: 'https://example.com/login?api_key=embedded-query-secret',
            username: FAKE_USERNAME,
            password: FAKE_PASSWORD,
          },
        },
      },
    },
  ])('rejects credentials embedded in the $label before any DB write', async ({ body }) => {
    const app = buildApp();
    const res = await request(app).post('/api/scans').send(body);

    expect(res.status).toBe(400);
    expect(capturedConfig).toBeUndefined();
    const count = getDatabase().prepare('SELECT COUNT(*) AS n FROM scans').get() as { n: number };
    expect(count.n).toBe(0);
  });
});
