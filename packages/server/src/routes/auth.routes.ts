import { Router } from 'express';
import { getPrincipal } from '../auth/middleware.js';

export interface AuthRoutesOptions {
  googleClientId?: string;
}

export function createAuthRoutes(options: AuthRoutesOptions = {}): Router {
  const router = Router();

  router.get('/config', (_req, res) => {
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ googleClientId: options.googleClientId ?? '', capabilityProtocol: 1 });
  });

  router.get('/me', (_req, res) => {
    res.set('Cache-Control', 'private, no-store');
    const principal = getPrincipal(res);
    if (principal.kind === 'anonymous') {
      res.json({ authenticated: false, role: 'anonymous' });
      return;
    }

    res.json({
      authenticated: true,
      role: principal.kind,
      email: principal.email,
      name: principal.name,
      pictureUrl: principal.pictureUrl,
    });
  });

  return router;
}
