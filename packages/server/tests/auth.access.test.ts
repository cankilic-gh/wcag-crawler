import { describe, expect, it } from 'vitest';
import {
  principalFromIdentity,
  type VerifiedGoogleIdentity,
} from '../src/auth/principal.js';
import {
  createScanCapability,
  hashScanCapability,
  isScanAccessible,
} from '../src/auth/scan-access.js';
import {
  ADMIN_POLICY,
  ANONYMOUS_POLICY,
  USER_POLICY,
  policyForPrincipal,
} from '../src/entitlements/policy.js';

const ADMIN_EMAIL = 'cankilic.mail@gmail.com';

function identity(overrides: Partial<VerifiedGoogleIdentity> = {}): VerifiedGoogleIdentity {
  return {
    sub: 'google-sub-fixture',
    email: 'user@example.com',
    emailVerified: true,
    name: 'Fixture User',
    pictureUrl: null,
    ...overrides,
  };
}

describe('principalFromIdentity', () => {
  it('assigns admin only from a verified, case-normalized allowlisted Google identity', () => {
    const principal = principalFromIdentity(
      identity({ email: '  CANKILIC.MAIL@GMAIL.COM  ' }),
      [ADMIN_EMAIL],
    );

    expect(principal).toMatchObject({
      kind: 'admin',
      googleSub: 'google-sub-fixture',
      email: ADMIN_EMAIL,
    });
  });

  it('assigns a verified non-admin Google identity the user role', () => {
    const principal = principalFromIdentity(identity(), [ADMIN_EMAIL]);

    expect(principal.kind).toBe('user');
  });

  it('rejects identities whose email is not verified', () => {
    expect(() => principalFromIdentity(
      identity({ emailVerified: false }),
      [ADMIN_EMAIL],
    )).toThrow(/verified/i);
  });
});

describe('principal entitlement policies', () => {
  it('keeps anonymous scans simple and forbids target-site authentication', () => {
    expect(policyForPrincipal({ kind: 'anonymous' })).toEqual(ANONYMOUS_POLICY);
    expect(ANONYMOUS_POLICY).toMatchObject({
      tier: 'anonymous', maxPages: 10, maxDepth: 2, maxConcurrency: 1,
      allowAuthentication: false,
    });
  });

  it('gives verified users limited scans without target-site authentication', () => {
    const principal = principalFromIdentity(identity(), [ADMIN_EMAIL]);
    expect(policyForPrincipal(principal)).toEqual(USER_POLICY);
    expect(USER_POLICY).toMatchObject({
      tier: 'user', maxPages: 50, maxDepth: 3, maxConcurrency: 2,
      allowAuthentication: false,
    });
  });

  it('gives only admins full configured limits and target-site authentication', () => {
    const principal = principalFromIdentity(identity({ email: ADMIN_EMAIL }), [ADMIN_EMAIL]);
    expect(policyForPrincipal(principal)).toEqual(ADMIN_POLICY);
    expect(ADMIN_POLICY).toMatchObject({
      tier: 'admin', maxPages: null, maxDepth: 5, maxConcurrency: 3,
      allowAuthentication: true,
    });
  });
});

describe('anonymous scan capability access', () => {
  it('stores only a hash and accepts only the matching raw capability token', () => {
    const capability = createScanCapability();

    expect(capability.token).toHaveLength(43);
    expect(capability.hash).toBe(hashScanCapability(capability.token));
    expect(capability.hash).not.toContain(capability.token);

    const scan = { ownerGoogleSub: null, accessTokenHash: capability.hash };
    expect(isScanAccessible(scan, { kind: 'anonymous' }, capability.token)).toBe(true);
    expect(isScanAccessible(scan, { kind: 'anonymous' }, 'wrong-token')).toBe(false);
    expect(isScanAccessible(scan, { kind: 'anonymous' }, undefined)).toBe(false);
  });

  it('allows only the owner for signed-in scans and always allows admin', () => {
    const owner = principalFromIdentity(identity({ sub: 'owner-sub' }), [ADMIN_EMAIL]);
    const other = principalFromIdentity(identity({ sub: 'other-sub' }), [ADMIN_EMAIL]);
    const admin = principalFromIdentity(identity({ sub: 'admin-sub', email: ADMIN_EMAIL }), [ADMIN_EMAIL]);
    const scan = { ownerGoogleSub: 'owner-sub', accessTokenHash: null };

    expect(isScanAccessible(scan, owner)).toBe(true);
    expect(isScanAccessible(scan, other)).toBe(false);
    expect(isScanAccessible(scan, { kind: 'anonymous' })).toBe(false);
    expect(isScanAccessible(scan, admin)).toBe(true);
  });

  it('makes legacy scans without owner/capability admin-only', () => {
    const legacy = { ownerGoogleSub: null, accessTokenHash: null };
    const admin = principalFromIdentity(identity({ email: ADMIN_EMAIL }), [ADMIN_EMAIL]);

    expect(isScanAccessible(legacy, { kind: 'anonymous' })).toBe(false);
    expect(isScanAccessible(legacy, principalFromIdentity(identity(), [ADMIN_EMAIL]))).toBe(false);
    expect(isScanAccessible(legacy, admin)).toBe(true);
  });
});
