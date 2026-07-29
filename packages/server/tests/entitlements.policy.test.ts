import { describe, expect, it } from 'vitest';
import {
  ADMIN_POLICY,
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

describe('applyEntitlements unlimited (admin) tier', () => {
  it('has a truly unlimited page cap represented as null', () => {
    // "Full WCAG" = unlimited page count for admin, not deeper crawling.
    expect(ADMIN_POLICY.maxPages).toBeNull();
    expect(ADMIN_POLICY.maxDepth).toBe(5);
  });

  it('passes an unlimited (null) page request through unchanged with no adjustment', () => {
    const requested = baseConfig({ maxPages: null, maxDepth: 5, concurrency: 3 });

    const result = applyEntitlements(requested, ADMIN_POLICY);

    expect(result.config.maxPages).toBeNull();
    expect(result.tier).toBe('admin');
    expect(result.adjustments.find(a => a.field === 'maxPages')).toBeUndefined();
  });

  it('leaves a finite page request unclamped under the unlimited cap', () => {
    const requested = baseConfig({ maxPages: 500, maxDepth: 5, concurrency: 3 });

    const result = applyEntitlements(requested, ADMIN_POLICY);

    expect(result.config.maxPages).toBe(500);
    expect(result.adjustments.find(a => a.field === 'maxPages')).toBeUndefined();
  });
});

describe('applyEntitlements null request against a finite tier', () => {
  it('clamps an unlimited (null) page request down to the finite cap and discloses it', () => {
    const requested = baseConfig({ maxPages: null, maxDepth: 2, concurrency: 1 });

    const result = applyEntitlements(requested, ANONYMOUS_POLICY);

    expect(result.config.maxPages).toBe(10);
    const adjustment = result.adjustments.find(a => a.field === 'maxPages');
    expect(adjustment).toMatchObject({ requested: null, applied: 10, limit: 10 });
  });
});
