import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express, { type Express, type RequestHandler } from 'express';
import request from 'supertest';
import type { Server as SocketServer } from 'socket.io';
import type { ScanConfig } from '../src/models/scan.model.js';
import type { IdentityVerifier } from '../src/auth/identity-verifier.js';
import type { PublicUrlChecker } from '../src/auth/network-policy.js';

process.env.DATABASE_PATH = ':memory:';

const { getDatabase, initializeDatabase } = await import('../src/db/database.js');
const { createOptionalAuthMiddleware } = await import('../src/auth/middleware.js');
const { createAuthRoutes } = await import('../src/routes/auth.routes.js');
const { createScanRoutes } = await import('../src/routes/scan.routes.js');
const { createReportRoutes } = await import('../src/routes/report.routes.js');
const { ScanModel } = await import('../src/models/scan.model.js');
const { createScanCreationRateLimiter } = await import('../src/auth/scan-rate-limit.js');

const ADMIN_EMAIL = 'cankilic.mail@gmail.com';
const ioStub = { to: () => ({ emit: () => {} }) } as unknown as SocketServer;
let runnerConfigs: ScanConfig[] = [];

const verifier: IdentityVerifier = {
  async verify(token) {
    if (token === 'user-token') {
      return {
        sub: 'user-sub', email: 'user@example.com', emailVerified: true,
        name: 'User', pictureUrl: null,
      };
    }
    if (token === 'other-token') {
      return {
        sub: 'other-sub', email: 'other@example.com', emailVerified: true,
        name: 'Other', pictureUrl: null,
      };
    }
    if (token === 'admin-token') {
      return {
        sub: 'admin-sub', email: ADMIN_EMAIL, emailVerified: true,
        name: 'Can', pictureUrl: null,
      };
    }
    throw new Error('invalid fixture token');
  },
};

function buildApp(
  scanCreateRateLimiter?: RequestHandler,
  publicUrlChecker: PublicUrlChecker = async () => true,
  cancelScan?: (scanId: string) => boolean,
  isScanScheduled?: (scanId: string) => boolean,
): Express {
  const app = express();
  app.use(express.json());
  app.use(createOptionalAuthMiddleware({ verifier, adminEmails: [ADMIN_EMAIL] }));
  app.use('/api/auth', createAuthRoutes({ googleClientId: 'fixture-client-id' }));
  app.use('/api/scans', createScanRoutes(ioStub, {
    runner: async (_id, _url, config) => { runnerConfigs.push(config); },
    scanCreateRateLimiter,
    publicUrlChecker,
    cancelScan,
    isScanScheduled,
  }));
  app.use('/api/reports', createReportRoutes());
  return app;
}

beforeAll(() => initializeDatabase());
beforeEach(() => {
  runnerConfigs = [];
  getDatabase().exec('DELETE FROM pages; DELETE FROM scans; DELETE FROM users');
});

describe('optional Google bearer authentication', () => {
  it('publishes the non-secret server audience for coordinated client deployment', async () => {
    const response = await request(buildApp()).get('/api/auth/config');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ googleClientId: 'fixture-client-id', capabilityProtocol: 1 });
  });

  it('treats a missing bearer as anonymous and rejects an invalid bearer', async () => {
    const app = buildApp();
    expect((await request(app).get('/api/auth/me')).body).toEqual({
      authenticated: false, role: 'anonymous',
    });
    const invalid = await request(app).get('/api/auth/me').set('Authorization', 'Bearer invalid');
    expect(invalid.status).toBe(401);
    expect(invalid.body).toEqual({ code: 'invalid_identity_token', error: 'Unauthorized' });
  });

  it('derives user/admin roles only from verified server-side identity', async () => {
    const app = buildApp();
    const user = await request(app).get('/api/auth/me').set('Authorization', 'Bearer user-token');
    const admin = await request(app).get('/api/auth/me').set('Authorization', 'Bearer admin-token');

    expect(user.body).toMatchObject({ authenticated: true, role: 'user', email: 'user@example.com' });
    expect(admin.body).toMatchObject({ authenticated: true, role: 'admin', email: ADMIN_EMAIL });
    expect(user.body).not.toHaveProperty('googleSub');
    expect(admin.body).not.toHaveProperty('googleSub');
  });
});

describe('scan ownership and tier enforcement', () => {
  it('refuses anonymous creation when the client cannot retain capability protocol v1', async () => {
    const response = await request(buildApp()).post('/api/scans').send({ url: 'https://example.com' });
    expect(response.status).toBe(428);
    expect(response.body.code).toBe('capability_protocol_required');
    expect(getDatabase().prepare('SELECT COUNT(*) AS count FROM scans').get()).toEqual({ count: 0 });
  });

  it('returns a one-time capability for an anonymous scan and requires it for detail', async () => {
    const app = buildApp();
    const created = await request(app).post('/api/scans').send({
      url: 'https://example.com',
      config: { maxPages: 100, maxDepth: 5, concurrency: 5 },
      capabilityProtocol: 1,
    });

    expect(created.status).toBe(201);
    expect(created.headers['cache-control']).toBe('private, no-store');
    expect(created.body.entitlement.tier).toBe('anonymous');
    expect(created.body.effectiveConfig).toMatchObject({ maxPages: 10, maxDepth: 2, concurrency: 1 });
    expect(created.body.accessToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const raw = getDatabase().prepare(
      'SELECT access_token_hash FROM scans WHERE id = ?',
    ).get(created.body.id) as { access_token_hash: string };
    expect(raw.access_token_hash).not.toBe(created.body.accessToken);
    expect(raw.access_token_hash).toHaveLength(64);

    expect((await request(app).get(`/api/scans/${created.body.id}`)).status).toBe(404);
    expect((await request(app).get(`/api/scans/${created.body.id}`).set('X-Scan-Token', 'wrong')).status).toBe(404);
    expect((await request(app).get(`/api/scans/${created.body.id}`).set('X-Scan-Token', created.body.accessToken)).status).toBe(200);
    expect((await request(app).get('/api/scans')).body).toEqual([]);
  });

  it('returns only caller-owned scans and hides records from other users', async () => {
    const app = buildApp();
    const owned = await request(app).post('/api/scans')
      .set('Authorization', 'Bearer user-token')
      .send({ url: 'https://owned.example.com' });
    await request(app).post('/api/scans')
      .set('Authorization', 'Bearer other-token')
      .send({ url: 'https://other.example.com' });

    expect(owned.body).not.toHaveProperty('accessToken');
    const ownList = await request(app).get('/api/scans').set('Authorization', 'Bearer user-token');
    expect(ownList.body).toHaveLength(1);
    expect(ownList.body[0].id).toBe(owned.body.id);
    expect((await request(app).get(`/api/scans/${owned.body.id}`).set('Authorization', 'Bearer other-token')).status).toBe(404);
    expect((await request(app).get(`/api/scans/${owned.body.id}`).set('Authorization', 'Bearer user-token')).status).toBe(200);
  });

  it('clamps negative list pagination instead of treating LIMIT -1 as unlimited', async () => {
    const app = buildApp();
    for (const url of ['https://one.example.com', 'https://two.example.com']) {
      await request(app).post('/api/scans')
        .set('Authorization', 'Bearer user-token')
        .send({ url });
    }
    const response = await request(app).get('/api/scans?limit=-1&offset=-5')
      .set('Authorization', 'Bearer user-token');
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
  });

  it('lets admin list/access every scan including legacy records', async () => {
    const app = buildApp();
    const owned = await request(app).post('/api/scans')
      .set('Authorization', 'Bearer user-token')
      .send({ url: 'https://owned.example.com' });
    getDatabase().prepare(
      "INSERT INTO scans (id, root_url, status, config) VALUES ('legacy', 'https://legacy.example.com', 'complete', '{}')",
    ).run();

    const list = await request(app).get('/api/scans').set('Authorization', 'Bearer admin-token');
    expect(list.status).toBe(200);
    expect(list.body.map((scan: { id: string }) => scan.id)).toEqual(expect.arrayContaining([owned.body.id, 'legacy']));
    expect((await request(app).get('/api/scans/legacy').set('Authorization', 'Bearer admin-token')).status).toBe(200);
  });

  it('forbids target-site credentials for anonymous/users and permits them for admin', async () => {
    const app = buildApp();
    const body = {
      url: 'https://example.com',
      capabilityProtocol: 1,
      config: {
        authentication: {
          authType: 'form', loginUrl: 'https://example.com/login',
          username: 'fixture-user', password: 'fixture-password',
        },
      },
    };

    expect((await request(app).post('/api/scans').send(body)).status).toBe(403);
    expect((await request(app).post('/api/scans').set('Authorization', 'Bearer user-token').send(body)).status).toBe(403);
    const admin = await request(app).post('/api/scans').set('Authorization', 'Bearer admin-token').send(body);
    expect(admin.status).toBe(201);
    expect(admin.body.entitlement.tier).toBe('admin');
    expect(runnerConfigs.at(-1)?.authentication?.username).toBe('fixture-user');
  });

  it('rejects private-network targets for anonymous/users and permits explicit admin access', async () => {
    const app = buildApp(undefined, async url => !url.includes('private.example'));
    const body = { url: 'http://private.example', capabilityProtocol: 1 };

    expect((await request(app).post('/api/scans').send(body)).status).toBe(400);
    expect((await request(app).post('/api/scans').set('Authorization', 'Bearer user-token').send(body)).status).toBe(400);
    expect(runnerConfigs).toHaveLength(0);

    const admin = await request(app).post('/api/scans')
      .set('Authorization', 'Bearer admin-token')
      .send(body);
    expect(admin.status).toBe(201);
    expect(runnerConfigs).toHaveLength(1);
  });

  it('cancels only through the requested scan ID handle', async () => {
    const cancelled: string[] = [];
    const app = buildApp(undefined, async () => true, scanId => {
      cancelled.push(scanId);
      return true;
    });
    const created = await request(app).post('/api/scans')
      .set('Authorization', 'Bearer user-token')
      .send({ url: 'https://example.com' });

    const response = await request(app).post(`/api/scans/${created.body.id}/cancel`)
      .set('Authorization', 'Bearer user-token');
    expect(response.status).toBe(200);
    expect(cancelled).toEqual([created.body.id]);
  });

  it('rejects deletion until an owned scan reaches a terminal state', async () => {
    let scheduled = true;
    const app = buildApp(undefined, async () => true, undefined, () => scheduled);
    const created = await request(app).post('/api/scans')
      .set('Authorization', 'Bearer user-token')
      .send({ url: 'https://example.com' });

    const runningDelete = await request(app).delete(`/api/scans/${created.body.id}`)
      .set('Authorization', 'Bearer user-token');
    expect(runningDelete.status).toBe(409);
    expect(runningDelete.body.code).toBe('scan_not_terminal');
    expect(ScanModel.findById(created.body.id)).not.toBeNull();

    getDatabase().prepare("UPDATE scans SET status = 'complete' WHERE id = ?").run(created.body.id);
    const cleanupDelete = await request(app).delete(`/api/scans/${created.body.id}`)
      .set('Authorization', 'Bearer user-token');
    expect(cleanupDelete.status).toBe(409);

    scheduled = false;
    expect((await request(app).delete(`/api/scans/${created.body.id}`)
      .set('Authorization', 'Bearer user-token')).status).toBe(204);
    expect(ScanModel.findById(created.body.id)).toBeNull();
  });
});

describe('scan creation rate limiting', () => {
  it('keeps anonymous IP and authenticated user buckets separate', async () => {
    const app = buildApp(createScanCreationRateLimiter({
      anonymous: 1,
      user: 1,
      admin: 2,
      windowMs: 60_000,
    }));
    const body = { url: 'https://example.com', capabilityProtocol: 1 };

    expect((await request(app).post('/api/scans').send(body)).status).toBe(201);
    const anonymousLimited = await request(app).post('/api/scans').send(body);
    expect(anonymousLimited.status).toBe(429);
    expect(anonymousLimited.body.code).toBe('scan_rate_limited');

    expect((await request(app).post('/api/scans').set('Authorization', 'Bearer user-token').send(body)).status).toBe(201);
    const userLimited = await request(app).post('/api/scans')
      .set('Authorization', 'Bearer user-token').send(body);
    expect(userLimited.status).toBe(429);
    expect(userLimited.body.code).toBe('scan_rate_limited');
  });
});

describe('report ownership enforcement', () => {
  it('requires the anonymous capability for report, HTML export, and fix report', async () => {
    const app = buildApp();
    const created = await request(app).post('/api/scans').send({
      url: 'https://example.com',
      capabilityProtocol: 1,
    });
    getDatabase().prepare("UPDATE scans SET status = 'complete' WHERE id = ?").run(created.body.id);

    for (const path of [
      `/api/reports/${created.body.id}`,
      `/api/reports/${created.body.id}/export?format=html`,
      `/api/reports/${created.body.id}/fix-report`,
    ]) {
      expect((await request(app).get(path)).status).toBe(404);
      expect((await request(app).get(path).set('X-Scan-Token', created.body.accessToken)).status).toBe(200);
    }
  });

  it('allows only owner or admin to read a signed-in report', async () => {
    const app = buildApp();
    const created = await request(app).post('/api/scans')
      .set('Authorization', 'Bearer user-token')
      .send({ url: 'https://example.com' });
    getDatabase().prepare("UPDATE scans SET status = 'complete' WHERE id = ?").run(created.body.id);

    expect((await request(app).get(`/api/reports/${created.body.id}`).set('Authorization', 'Bearer other-token')).status).toBe(404);
    expect((await request(app).get(`/api/reports/${created.body.id}`).set('Authorization', 'Bearer user-token')).status).toBe(200);
    expect((await request(app).get(`/api/reports/${created.body.id}`).set('Authorization', 'Bearer admin-token')).status).toBe(200);
  });
});
