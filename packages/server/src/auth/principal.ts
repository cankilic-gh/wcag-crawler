export interface VerifiedGoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  pictureUrl: string | null;
}

export interface AnonymousPrincipal {
  kind: 'anonymous';
}

export interface AuthenticatedPrincipal {
  kind: 'user' | 'admin';
  googleSub: string;
  email: string;
  name: string | null;
  pictureUrl: string | null;
}

export type Principal = AnonymousPrincipal | AuthenticatedPrincipal;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function principalFromIdentity(
  identity: VerifiedGoogleIdentity,
  adminEmails: readonly string[],
): AuthenticatedPrincipal {
  if (!identity.emailVerified) {
    throw new Error('Google identity email must be verified');
  }
  if (!identity.sub.trim()) {
    throw new Error('Google identity subject is required');
  }

  const email = normalizeEmail(identity.email);
  const allowlist = new Set(adminEmails.map(normalizeEmail));
  return {
    kind: allowlist.has(email) ? 'admin' : 'user',
    googleSub: identity.sub,
    email,
    name: identity.name,
    pictureUrl: identity.pictureUrl,
  };
}
