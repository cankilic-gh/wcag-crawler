import { beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { IdentityVerifier } from '../src/auth/identity-verifier.js';

process.env.DATABASE_PATH = ':memory:';

const { initializeDatabase } = await import('../src/db/database.js');
const { createOptionalAuthMiddleware } = await import('../src/auth/middleware.js');
const { createSystemRoutes } = await import('../src/routes/system.routes.js');

const verifier: IdentityVerifier = {
  async verify(token) {
    return {
      sub: token,
      email: token === 'admin' ? 'cankilic.mail@gmail.com' : 'user@example.com',
      emailVerified: true,
      name: null,
      pictureUrl: null,
    };
  },
};

beforeAll(() => initializeDatabase());

describe('system route authorization', () => {
  it('keeps health public but makes Railway billing usage admin-only', async () => {
    const app = express();
    app.use(createOptionalAuthMiddleware({
      verifier,
      adminEmails: ['cankilic.mail@gmail.com'],
    }));
    app.use('/api/system', createSystemRoutes());

    expect((await request(app).get('/api/system/health')).status).toBe(200);
    expect((await request(app).get('/api/system/railway-usage')).status).toBe(404);
    expect((await request(app).get('/api/system/railway-usage').set('Authorization', 'Bearer user')).status).toBe(404);
    const adminResponse = await request(app).get('/api/system/railway-usage').set('Authorization', 'Bearer admin');
    expect(adminResponse.status).not.toBe(404);
    expect(adminResponse.headers['cache-control']).toBe('private, no-store');
  });
});
