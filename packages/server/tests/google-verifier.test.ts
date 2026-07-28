import { describe, expect, it } from 'vitest';
import type { GoogleTokenClient } from '../src/auth/google-identity-verifier.js';

const { GoogleIdentityVerifier } = await import('../src/auth/google-identity-verifier.js');

function fakeClient(payload: Record<string, unknown> | undefined) {
  const calls: Array<{ idToken: string; audience: string }> = [];
  const client: GoogleTokenClient = {
    async verifyIdToken(options) {
      calls.push(options);
      return { getPayload: () => payload };
    },
  };
  return { client, calls };
}

describe('GoogleIdentityVerifier', () => {
  it('delegates cryptographic/audience validation to Google and maps a verified identity', async () => {
    const { client, calls } = fakeClient({
      sub: 'google-sub',
      email: 'USER@GMAIL.COM',
      email_verified: true,
      name: 'User Name',
      picture: 'https://example.com/avatar.png',
    });
    const verifier = new GoogleIdentityVerifier('google-client-id', client);

    await expect(verifier.verify('fixture-id-token')).resolves.toEqual({
      sub: 'google-sub',
      email: 'USER@GMAIL.COM',
      emailVerified: true,
      name: 'User Name',
      pictureUrl: 'https://example.com/avatar.png',
    });
    expect(calls).toEqual([{ idToken: 'fixture-id-token', audience: 'google-client-id' }]);
  });

  it.each([
    { sub: undefined, email: 'user@gmail.com', email_verified: true },
    { sub: 'sub', email: undefined, email_verified: true },
    { sub: 'sub', email: 'user@gmail.com', email_verified: false },
    undefined,
  ])('rejects missing or unverified identity payload %#', async (payload) => {
    const { client } = fakeClient(payload);
    const verifier = new GoogleIdentityVerifier('google-client-id', client);
    await expect(verifier.verify('fixture-id-token')).rejects.toThrow(/identity/i);
  });

  it('rejects empty Google client configuration', () => {
    expect(() => new GoogleIdentityVerifier('  ')).toThrow(/client id/i);
  });
});
