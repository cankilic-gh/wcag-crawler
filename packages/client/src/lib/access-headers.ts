import { authTokenStorage } from './auth-token-storage';
import { scanStorage } from './storage';

export function accessHeadersForScan(scanId?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const identityToken = authTokenStorage.get();
  if (identityToken) headers.Authorization = `Bearer ${identityToken}`;

  if (scanId) {
    const accessToken = scanStorage.getAccessToken(scanId);
    if (accessToken) headers['X-Scan-Token'] = accessToken;
  }
  return headers;
}

export function socketJoinPayloadForScan(scanId: string) {
  const headers = accessHeadersForScan(scanId);
  return {
    scanId,
    identityToken: headers.Authorization?.replace(/^Bearer\s+/i, ''),
    accessToken: headers['X-Scan-Token'],
  };
}
