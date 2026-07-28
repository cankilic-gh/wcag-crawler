import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { getPrincipal } from './middleware.js';

export interface ScanRateLimits {
  anonymous: number;
  user: number;
  admin: number;
  windowMs: number;
}

const DEFAULT_LIMITS: ScanRateLimits = {
  anonymous: 3,
  user: 20,
  admin: 100,
  windowMs: 60 * 60 * 1000,
};

export function createScanCreationRateLimiter(limits: ScanRateLimits = DEFAULT_LIMITS) {
  return rateLimit({
    windowMs: limits.windowMs,
    limit: (_req, res) => limits[getPrincipal(res).kind],
    keyGenerator: (req, res) => {
      const principal = getPrincipal(res);
      return principal.kind === 'anonymous'
        ? `ip:${ipKeyGenerator(req.ip ?? 'unknown')}`
        : `sub:${principal.googleSub}`;
    },
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: 'Too many scan requests. Please try again later.',
        code: 'scan_rate_limited',
      });
    },
  });
}
