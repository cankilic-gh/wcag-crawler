import type { IdentityVerifier } from './identity-verifier.js';
import { principalFromIdentity, type Principal } from './principal.js';
import { isScanAccessible } from './scan-access.js';
import { ScanModel } from '../models/scan.model.js';

export interface SocketJoinRequest {
  scanId: string;
  identityToken?: string;
  accessToken?: string;
}

export interface SocketAccessOptions {
  verifier: IdentityVerifier;
  adminEmails: readonly string[];
}

export type SocketAccessAuthorizer = (payload: unknown) => Promise<boolean>;

function parseJoinRequest(payload: unknown): SocketJoinRequest | null {
  if (!payload || typeof payload !== 'object') return null;
  const candidate = payload as Record<string, unknown>;
  if (typeof candidate.scanId !== 'string' || !candidate.scanId) return null;
  if (candidate.identityToken !== undefined && typeof candidate.identityToken !== 'string') return null;
  if (candidate.accessToken !== undefined && typeof candidate.accessToken !== 'string') return null;
  return {
    scanId: candidate.scanId,
    identityToken: candidate.identityToken as string | undefined,
    accessToken: candidate.accessToken as string | undefined,
  };
}

export function createSocketAccessAuthorizer(options: SocketAccessOptions): SocketAccessAuthorizer {
  return async (payload) => {
    const request = parseJoinRequest(payload);
    if (!request) return false;

    let principal: Principal = { kind: 'anonymous' };
    if (request.identityToken) {
      try {
        const identity = await options.verifier.verify(request.identityToken);
        principal = principalFromIdentity(identity, options.adminEmails);
      } catch {
        return false;
      }
    }

    const access = ScanModel.findAccessById(request.scanId);
    return access !== null && isScanAccessible(access, principal, request.accessToken);
  };
}
