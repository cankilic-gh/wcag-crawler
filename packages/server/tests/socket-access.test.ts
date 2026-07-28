import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { IdentityVerifier } from '../src/auth/identity-verifier.js';
import type { ScanConfig } from '../src/models/scan.model.js';

process.env.DATABASE_PATH = ':memory:';

const { initializeDatabase, getDatabase } = await import('../src/db/database.js');
const { ScanModel } = await import('../src/models/scan.model.js');
const { UserModel } = await import('../src/models/user.model.js');
const { createScanCapability } = await import('../src/auth/scan-access.js');
const { createSocketAccessAuthorizer } = await import('../src/auth/socket-access.js');

const ADMIN_EMAIL = 'cankilic.mail@gmail.com';
const verifier: IdentityVerifier = {
  async verify(token) {
    if (token === 'owner-token') return {
      sub: 'owner-sub', email: 'owner@example.com', emailVerified: true,
      name: null, pictureUrl: null,
    };
    if (token === 'admin-token') return {
      sub: 'admin-sub', email: ADMIN_EMAIL, emailVerified: true,
      name: null, pictureUrl: null,
    };
    throw new Error('invalid token');
  },
};

const config: ScanConfig = {
  maxPages: 10, maxDepth: 2, concurrency: 1, delay: 500,
  excludePatterns: [], waitForSelector: null, respectRobotsTxt: true,
  viewport: { width: 1280, height: 720 }, authentication: null,
  wcagVersion: '2.1', entitlementTier: 'anonymous',
};

beforeAll(() => initializeDatabase());
beforeEach(() => getDatabase().exec('DELETE FROM scans; DELETE FROM users'));

describe('Socket.IO scan room authorization', () => {
  it('requires a matching anonymous capability and rejects scan-id-only joins', async () => {
    const capability = createScanCapability();
    const scan = ScanModel.create('https://example.com', config, {
      ownerGoogleSub: null, accessTokenHash: capability.hash,
    });
    const authorize = createSocketAccessAuthorizer({ verifier, adminEmails: [ADMIN_EMAIL] });

    await expect(authorize({ scanId: scan.id })).resolves.toBe(false);
    await expect(authorize({ scanId: scan.id, accessToken: 'wrong' })).resolves.toBe(false);
    await expect(authorize({ scanId: scan.id, accessToken: capability.token })).resolves.toBe(true);
  });

  it('allows owner/admin identity tokens and rejects invalid/other identity tokens', async () => {
    UserModel.upsertGoogleIdentity({
      sub: 'owner-sub', email: 'owner@example.com', emailVerified: true,
      name: null, pictureUrl: null,
    });
    const scan = ScanModel.create('https://example.com', config, {
      ownerGoogleSub: 'owner-sub', accessTokenHash: null,
    });
    const authorize = createSocketAccessAuthorizer({ verifier, adminEmails: [ADMIN_EMAIL] });

    await expect(authorize({ scanId: scan.id, identityToken: 'owner-token' })).resolves.toBe(true);
    await expect(authorize({ scanId: scan.id, identityToken: 'admin-token' })).resolves.toBe(true);
    await expect(authorize({ scanId: scan.id, identityToken: 'invalid' })).resolves.toBe(false);
    await expect(authorize({ scanId: scan.id })).resolves.toBe(false);
  });

  it('fails closed for malformed payloads and unknown scans', async () => {
    const authorize = createSocketAccessAuthorizer({ verifier, adminEmails: [ADMIN_EMAIL] });
    await expect(authorize(null)).resolves.toBe(false);
    await expect(authorize('scan-id')).resolves.toBe(false);
    await expect(authorize({ scanId: 'missing' })).resolves.toBe(false);
  });
});
