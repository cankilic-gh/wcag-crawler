import { describe, expect, it } from 'vitest';
import { redactScanConfig } from '../src/entitlements/redaction.js';
import type { ScanConfig } from '../src/models/scan.model.js';

function baseConfig(overrides: Partial<ScanConfig> = {}): ScanConfig {
  return {
    maxPages: 50,
    maxDepth: 5,
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

describe('redactScanConfig maxPages persistence', () => {
  it('preserves an intentional null (unlimited) maxPages rather than dropping the config', () => {
    const out = redactScanConfig(baseConfig({ maxPages: null }));

    expect(out.maxPages).toBeNull();
    // The config is still recognized as valid (not coerced to {}).
    expect(out.maxDepth).toBe(5);
    expect(out.concurrency).toBe(3);
  });

  it('still treats a non-numeric maxPages as malformed and drops it', () => {
    expect(redactScanConfig(baseConfig({ maxPages: 'nope' as never }))).toEqual({});
  });
});
