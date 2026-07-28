import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_INVALID_EVENT, expireStoredIdentity } from './auth-expiry';
import { authTokenStorage } from './auth-token-storage';

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  vi.stubGlobal('window', new EventTarget());
});

describe('expireStoredIdentity', () => {
  it('clears the stale token and notifies the auth state owner', () => {
    let notified = false;
    window.addEventListener(AUTH_INVALID_EVENT, () => { notified = true; });
    authTokenStorage.set('expired-token');

    expireStoredIdentity();

    expect(authTokenStorage.get()).toBeNull();
    expect(notified).toBe(true);
  });
});
