import { describe, expect, it } from 'vitest';
import {
  ANONYMOUS_POLICY,
  applyEntitlements,
} from '../src/entitlements/policy.js';
import type { ScanConfig } from '../src/models/scan.model.js';

function baseConfig(overrides: Partial<ScanConfig> = {}): ScanConfig {
  return {
    maxPages: 50,
    maxDepth: 3,
    concurrency: 3,
    delay: 500,
    excludePatterns: [],
    waitForSelector: null,
    respectRobotsTxt: true,
    viewport: { width: 1280, height: 720 },
    authentication: null,
    wcagVersion: '2.1',
    ...overrides,
  };
}

describe('applyEntitlements clamp', () => {
  it('clamps numeric overages to the QUICK policy caps and discloses adjustments', () => {
    const requested = baseConfig({ maxPages: 100, maxDepth: 5, concurrency: 5 });

    const result = applyEntitlements(requested, ANONYMOUS_POLICY);

    // Effective config is clamped to the anonymous QUICK caps.
    expect(result.config.maxPages).toBe(10);
    expect(result.config.maxDepth).toBe(2);
    expect(result.config.concurrency).toBe(1);
    expect(result.tier).toBe('anonymous');
    expect(result.config.entitlementTier).toBe('anonymous');

    // Every clamp is disclosed with requested/applied/limit.
    const byField = Object.fromEntries(result.adjustments.map(a => [a.field, a]));
    expect(byField.maxPages).toMatchObject({ requested: 100, applied: 10, limit: 10 });
    expect(byField.maxDepth).toMatchObject({ requested: 5, applied: 2, limit: 2 });
    expect(byField.concurrency).toMatchObject({ requested: 5, applied: 1, limit: 1 });

    // Clamps, not rejection: original input is not mutated.
    expect(requested.maxPages).toBe(100);
  });
});

describe('applyEntitlements passthrough', () => {
  it('passes a within-limit config through unchanged with no adjustments', () => {
    const requested = baseConfig({ maxPages: 8, maxDepth: 2, concurrency: 1 });

    const result = applyEntitlements(requested, ANONYMOUS_POLICY);

    expect(result.adjustments).toEqual([]);
    expect(result.config.maxPages).toBe(8);
    expect(result.config.maxDepth).toBe(2);
    expect(result.config.concurrency).toBe(1);
    // Tier is still stamped even when nothing is clamped.
    expect(result.config.entitlementTier).toBe('anonymous');
  });

  it('passes values exactly at the cap through without recording an adjustment', () => {
    const requested = baseConfig({ maxPages: 10, maxDepth: 2, concurrency: 1 });

    const result = applyEntitlements(requested, ANONYMOUS_POLICY);

    expect(result.adjustments).toEqual([]);
    expect(result.config.maxPages).toBe(10);
    expect(result.config.maxDepth).toBe(2);
    expect(result.config.concurrency).toBe(1);
  });
});
