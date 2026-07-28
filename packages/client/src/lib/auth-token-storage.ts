const STORAGE_KEY = 'wcag-google-identity-token';

function getSessionStorage(): Storage | null {
  return typeof sessionStorage === 'undefined' ? null : sessionStorage;
}

export const authTokenStorage = {
  get(): string | null {
    return getSessionStorage()?.getItem(STORAGE_KEY) ?? null;
  },

  set(token: string): void {
    getSessionStorage()?.setItem(STORAGE_KEY, token);
  },

  clear(): void {
    getSessionStorage()?.removeItem(STORAGE_KEY);
  },
};
