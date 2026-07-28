import { describe, expect, it } from 'vitest';
import {
  createBrowserNetworkGuard,
  isPublicAddress,
  isPubliclyRoutableUrl,
} from '../src/auth/network-policy.js';

describe('public scan network policy', () => {
  it('rejects private, local, metadata, carrier-grade NAT, multicast, and reserved IPs', () => {
    for (const address of [
      '0.0.0.0', '10.0.0.1', '100.64.0.1', '127.0.0.1', '169.254.169.254',
      '172.16.0.1', '192.168.1.1', '224.0.0.1', '255.255.255.255',
      '::', '::1', 'fc00::1', 'fe80::1', 'ff02::1', '::ffff:127.0.0.1',
    ]) {
      expect(isPublicAddress(address), address).toBe(false);
    }
    expect(isPublicAddress('8.8.8.8')).toBe(true);
    expect(isPublicAddress('2606:4700:4700::1111')).toBe(true);
  });

  it('requires every DNS answer to be public and fails closed on DNS errors', async () => {
    const publicResolver = async () => ['93.184.216.34'];
    const mixedResolver = async () => ['93.184.216.34', '10.0.0.5'];
    const failingResolver = async () => { throw new Error('dns failed'); };

    await expect(isPubliclyRoutableUrl('https://example.com', publicResolver)).resolves.toBe(true);
    await expect(isPubliclyRoutableUrl('https://example.com', mixedResolver)).resolves.toBe(false);
    await expect(isPubliclyRoutableUrl('https://example.com', failingResolver)).resolves.toBe(false);
    await expect(isPubliclyRoutableUrl('http://metadata.google.internal')).resolves.toBe(false);
    await expect(isPubliclyRoutableUrl('http://127.0.0.1')).resolves.toBe(false);
  });

  it('aborts browser requests that fail the same network policy', async () => {
    const calls: string[] = [];
    const route = {
      request: () => ({ url: () => 'http://private.example/metadata' }),
      continue: async () => { calls.push('continue'); },
      abort: async () => { calls.push('abort'); },
    };
    const guard = createBrowserNetworkGuard(async () => false);
    await guard(route);
    expect(calls).toEqual(['abort']);
  });
});
