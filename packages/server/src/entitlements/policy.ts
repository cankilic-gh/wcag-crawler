import type { Request } from 'express';
import type { ScanConfig, EntitlementTier } from '../models/scan.model.js';
import type { Principal } from '../auth/principal.js';

export type { EntitlementTier };

/**
 * Entitlement layer — billing-independent, request-scoped.
 *
 * The scan pipeline is gated by an EntitlementPolicy, not by any payment
 * provider. Identity maps onto one of three policies; scan execution remains
 * independent from Google, billing, or any future workspace provider.
 */

export interface EntitlementPolicy {
  tier: EntitlementTier;
  maxPages: number;
  maxDepth: number;
  maxConcurrency: number;
  /** Whether the tier is permitted to run authenticated (behind-login) scans. */
  allowAuthentication: boolean;
}

/**
 * Anonymous quick-scan policy. Honest, limited defaults enforced server-side
 * so the client cannot exceed them. Authentication stays allowed for now.
 */
export const ANONYMOUS_POLICY: EntitlementPolicy = {
  tier: 'anonymous',
  maxPages: 10,
  maxDepth: 2,
  maxConcurrency: 1,
  allowAuthentication: false,
};

export const USER_POLICY: EntitlementPolicy = {
  tier: 'user',
  maxPages: 50,
  maxDepth: 3,
  maxConcurrency: 2,
  allowAuthentication: false,
};

export const ADMIN_POLICY: EntitlementPolicy = {
  tier: 'admin',
  maxPages: 100,
  maxDepth: 5,
  maxConcurrency: 3,
  allowAuthentication: true,
};

/** Backward-compatible name while route callers migrate to identity policies. */
export const QUICK_POLICY = ANONYMOUS_POLICY;

export function policyForPrincipal(principal: Principal): EntitlementPolicy {
  if (principal.kind === 'admin') return ADMIN_POLICY;
  if (principal.kind === 'user') return USER_POLICY;
  return ANONYMOUS_POLICY;
}

export interface EntitlementAdjustment {
  field: 'maxPages' | 'maxDepth' | 'concurrency';
  requested: number;
  applied: number;
  limit: number;
}

export interface AppliedEntitlements {
  tier: EntitlementTier;
  config: ScanConfig;
  adjustments: EntitlementAdjustment[];
}

/**
 * Pure function: clamp a requested scan config to a policy's caps.
 *
 * Numeric overages are clamped (never rejected). Absolute Zod bounds are
 * validated upstream; this only narrows further to the tier's caps. Every
 * clamp is recorded as an adjustment so the response can disclose exactly
 * what changed. The input config is never mutated.
 */
export function applyEntitlements(
  config: ScanConfig,
  policy: EntitlementPolicy,
): AppliedEntitlements {
  const adjustments: EntitlementAdjustment[] = [];

  const clamp = (
    field: EntitlementAdjustment['field'],
    requested: number,
    limit: number,
  ): number => {
    if (requested > limit) {
      adjustments.push({ field, requested, applied: limit, limit });
      return limit;
    }
    return requested;
  };

  const effective: ScanConfig = {
    ...config,
    maxPages: clamp('maxPages', config.maxPages, policy.maxPages),
    maxDepth: clamp('maxDepth', config.maxDepth, policy.maxDepth),
    concurrency: clamp('concurrency', config.concurrency, policy.maxConcurrency),
    entitlementTier: policy.tier,
  };

  return { tier: policy.tier, config: effective, adjustments };
}

/**
 * Request-scoped seam. Future workspace auth replaces only this resolver to
 * map an authenticated request onto a richer policy.
 */
export type EntitlementResolver = (req: Request) => EntitlementPolicy;

/** Default resolver: every request gets the anonymous policy. */
export const anonymousQuickResolver: EntitlementResolver = () => ANONYMOUS_POLICY;
