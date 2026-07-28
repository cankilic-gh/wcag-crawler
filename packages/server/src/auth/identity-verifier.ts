import type { VerifiedGoogleIdentity } from './principal.js';

export interface IdentityVerifier {
  verify(token: string): Promise<VerifiedGoogleIdentity>;
}
