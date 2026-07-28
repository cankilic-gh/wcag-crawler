import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Principal } from './principal.js';

export interface ScanAccessRecord {
  ownerGoogleSub: string | null;
  accessTokenHash: string | null;
}

export interface ScanCapability {
  token: string;
  hash: string;
}

export function hashScanCapability(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function createScanCapability(): ScanCapability {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashScanCapability(token) };
}

function capabilityMatches(expectedHash: string, token: string | undefined): boolean {
  if (!token) return false;
  const actual = Buffer.from(hashScanCapability(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function isScanAccessible(
  scan: ScanAccessRecord,
  principal: Principal,
  capabilityToken?: string,
): boolean {
  if (principal.kind === 'admin') return true;

  if (scan.ownerGoogleSub) {
    return principal.kind === 'user' && principal.googleSub === scan.ownerGoogleSub;
  }

  if (scan.accessTokenHash) {
    return capabilityMatches(scan.accessTokenHash, capabilityToken);
  }

  // Legacy scans predate ownership/capability data and are admin-only.
  return false;
}
