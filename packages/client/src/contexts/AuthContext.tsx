import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi } from '../lib/api';
import { authTokenStorage } from '../lib/auth-token-storage';
import { resetSocketSession } from '../hooks/useSocket';
import { AUTH_INVALID_EVENT } from '../lib/auth-expiry';
import type { AuthStateResponse, EntitlementTier } from '../types';

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleAccountsId {
  initialize(options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
  }): void;
  renderButton(element: HTMLElement, options: Record<string, unknown>): void;
  disableAutoSelect(): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

interface AuthContextValue {
  state: AuthStateResponse;
  role: EntitlementTier;
  loading: boolean;
  configured: boolean;
  googleReady: boolean;
  renderGoogleButton(element: HTMLElement): void;
  signOut(): void;
}

const ANONYMOUS_STATE: AuthStateResponse = {
  authenticated: false,
  role: 'anonymous',
};

const AuthContext = createContext<AuthContextValue>({
  state: ANONYMOUS_STATE,
  role: 'anonymous',
  loading: false,
  configured: false,
  googleReady: false,
  renderGoogleButton: () => {},
  signOut: () => {},
});

const GOOGLE_SCRIPT_ID = 'google-identity-services';

function loadGoogleScript(onReady: () => void): () => void {
  if (window.google?.accounts.id) {
    onReady();
    return () => {};
  }

  let script = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = GOOGLE_SCRIPT_ID;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }
  script.addEventListener('load', onReady);
  return () => script?.removeEventListener('load', onReady);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? '';
  const [state, setState] = useState<AuthStateResponse>(ANONYMOUS_STATE);
  const [loading, setLoading] = useState(Boolean(authTokenStorage.get()));
  const [googleReady, setGoogleReady] = useState(false);
  const [audienceMatches, setAudienceMatches] = useState(false);

  const acceptCredential = useCallback(async (response: GoogleCredentialResponse) => {
    if (!response.credential) return;
    authTokenStorage.set(response.credential);
    setLoading(true);
    try {
      setState(await authApi.me());
    } catch {
      authTokenStorage.clear();
      setState(ANONYMOUS_STATE);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const existingToken = authTokenStorage.get();
    if (!existingToken) return;
    authApi.me()
      .then(setState)
      .catch(() => {
        authTokenStorage.clear();
        setState(ANONYMOUS_STATE);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onInvalidIdentity = () => {
      resetSocketSession();
      setState(ANONYMOUS_STATE);
      setLoading(false);
    };
    window.addEventListener(AUTH_INVALID_EVENT, onInvalidIdentity);
    return () => window.removeEventListener(AUTH_INVALID_EVENT, onInvalidIdentity);
  }, []);

  useEffect(() => {
    if (!clientId) {
      setAudienceMatches(false);
      return;
    }
    authApi.config()
      .then(config => setAudienceMatches(config.googleClientId === clientId))
      .catch(() => setAudienceMatches(false));
  }, [clientId]);

  useEffect(() => {
    if (!clientId || !audienceMatches) return;
    return loadGoogleScript(() => {
      window.google?.accounts.id.initialize({
        client_id: clientId,
        callback: acceptCredential,
      });
      setGoogleReady(Boolean(window.google?.accounts.id));
    });
  }, [acceptCredential, audienceMatches, clientId]);

  const renderGoogleButton = useCallback((element: HTMLElement) => {
    if (!googleReady) return;
    window.google?.accounts.id.renderButton(element, {
      type: 'standard',
      theme: 'outline',
      size: 'medium',
      text: 'signin_with',
      shape: 'pill',
    });
  }, [googleReady]);

  const signOut = useCallback(() => {
    resetSocketSession();
    authTokenStorage.clear();
    window.google?.accounts.id.disableAutoSelect();
    setState(ANONYMOUS_STATE);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    state,
    role: state.role,
    loading,
    configured: Boolean(clientId && audienceMatches),
    googleReady,
    renderGoogleButton,
    signOut,
  }), [audienceMatches, clientId, googleReady, loading, renderGoogleButton, signOut, state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
