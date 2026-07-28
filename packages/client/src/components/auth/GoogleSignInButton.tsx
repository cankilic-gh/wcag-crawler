import { useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export function GoogleSignInButton() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { configured, googleReady, renderGoogleButton } = useAuth();

  useEffect(() => {
    if (!containerRef.current || !googleReady) return;
    containerRef.current.replaceChildren();
    renderGoogleButton(containerRef.current);
  }, [googleReady, renderGoogleButton]);

  if (!configured) return null;
  return <div ref={containerRef} aria-label="Sign in with Google" />;
}
