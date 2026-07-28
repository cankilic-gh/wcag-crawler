import { authTokenStorage } from './auth-token-storage';

export const AUTH_INVALID_EVENT = 'wcag:identity-invalid';

export function expireStoredIdentity(): void {
  authTokenStorage.clear();
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(AUTH_INVALID_EVENT));
}
