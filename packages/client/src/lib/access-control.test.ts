import { beforeEach, describe, expect, it, vi } from 'vitest';
import { accessHeadersForScan, socketJoinPayloadForScan } from './access-headers';
import { authTokenStorage } from './auth-token-storage';
import { scanStorage } from './storage';
import { clientPolicyForRole } from './tier-policy';

const localData = new Map<string, string>();
const sessionData = new Map<string, string>();
const createStorage = (data: Map<string, string>) => ({
  getItem: vi.fn((key: string) => data.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => { data.set(key, value); }),
  removeItem: vi.fn((key: string) => { data.delete(key); }),
  clear: vi.fn(() => data.clear()),
  key: vi.fn(() => null),
  get length() { return data.size; },
});

beforeEach(() => {
  localData.clear();
  sessionData.clear();
  vi.stubGlobal('localStorage', createStorage(localData));
  vi.stubGlobal('sessionStorage', createStorage(sessionData));
});

describe('client access headers', () => {
  it('uses session-only Google identity and per-scan anonymous capability', () => {
    authTokenStorage.set('google-id-token');
    scanStorage.add({
      id: 'scan_1', url: 'https://example.com', createdAt: '2026-07-28T00:00:00Z',
      accessToken: 'anonymous-capability',
    });

    expect(accessHeadersForScan('scan_1')).toEqual({
      Authorization: 'Bearer google-id-token',
      'X-Scan-Token': 'anonymous-capability',
    });
    expect(accessHeadersForScan('scan_other')).toEqual({
      Authorization: 'Bearer google-id-token',
    });
    expect(socketJoinPayloadForScan('scan_1')).toEqual({
      scanId: 'scan_1',
      identityToken: 'google-id-token',
      accessToken: 'anonymous-capability',
    });
  });

  it('never stores the Google identity token in localStorage', () => {
    authTokenStorage.set('google-id-token');
    expect(sessionStorage.getItem('wcag-google-identity-token')).toBe('google-id-token');
    expect(localStorage.getItem('wcag-google-identity-token')).toBeNull();
    authTokenStorage.clear();
    expect(authTokenStorage.get()).toBeNull();
  });
});

describe('client role policies', () => {
  it('mirrors server anonymous/user/admin limits and target-auth eligibility', () => {
    expect(clientPolicyForRole('anonymous')).toEqual({
      maxPages: 10, maxDepth: 2, concurrency: 1, allowAuthentication: false,
    });
    expect(clientPolicyForRole('user')).toEqual({
      maxPages: 50, maxDepth: 3, concurrency: 2, allowAuthentication: false,
    });
    // Admin has a truly unlimited page count (null), mirroring the server.
    expect(clientPolicyForRole('admin')).toEqual({
      maxPages: null, maxDepth: 5, concurrency: 3, allowAuthentication: true,
    });
  });
});
