import { OAuth2Client } from 'google-auth-library';
import type { IdentityVerifier } from './identity-verifier.js';
import type { VerifiedGoogleIdentity } from './principal.js';

interface GoogleTokenPayload {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

export interface GoogleTokenClient {
  verifyIdToken(options: {
    idToken: string;
    audience: string;
  }): Promise<{ getPayload(): GoogleTokenPayload | undefined }>;
}

export class GoogleIdentityVerifier implements IdentityVerifier {
  private readonly clientId: string;
  private readonly client: GoogleTokenClient;

  constructor(clientId: string, client?: GoogleTokenClient) {
    this.clientId = clientId.trim();
    if (!this.clientId) {
      throw new Error('Google client ID is required');
    }
    this.client = client ?? new OAuth2Client();
  }

  async verify(token: string): Promise<VerifiedGoogleIdentity> {
    const ticket = await this.client.verifyIdToken({
      idToken: token,
      audience: this.clientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      throw new Error('Google identity is missing required verified claims');
    }

    return {
      sub: payload.sub,
      email: payload.email,
      emailVerified: true,
      name: payload.name ?? null,
      pictureUrl: payload.picture ?? null,
    };
  }
}
