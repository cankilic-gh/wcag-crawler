import { describe, expect, it } from 'vitest';
import { nextBatchSize } from '../src/utils/crawl-limit.js';

describe('nextBatchSize — finite page budget', () => {
  it('reserves exactly the remaining budget so a concurrency batch never overshoots maxPages', () => {
    // A user at 49 attempted pages with concurrency 2 must launch only 1 more,
    // not 2 (which would attempt page 51 and exceed the 50 cap).
    expect(nextBatchSize(10, 2, 49, 50)).toBe(1);
  });

  it('uses full concurrency while comfortably under the cap', () => {
    expect(nextBatchSize(10, 2, 0, 50)).toBe(2);
    expect(nextBatchSize(10, 2, 40, 50)).toBe(2);
  });

  it('returns 0 once the budget is exhausted', () => {
    expect(nextBatchSize(10, 2, 50, 50)).toBe(0);
    expect(nextBatchSize(10, 2, 51, 50)).toBe(0);
  });

  it('never exceeds the cap across a full accumulated crawl', () => {
    // Simulate the crawler loop with an always-full queue: total attempted
    // must land exactly on maxPages and never above it.
    let attempted = 0;
    for (let guard = 0; guard < 1000; guard++) {
      const size = nextBatchSize(100, 3, attempted, 50);
      if (size === 0) break;
      attempted += size;
      expect(attempted).toBeLessThanOrEqual(50);
    }
    expect(attempted).toBe(50);
  });
});

describe('nextBatchSize — unlimited (admin) budget', () => {
  it('uses queue/concurrency and ignores the attempted count when maxPages is null', () => {
    expect(nextBatchSize(10, 2, 1000, null)).toBe(2);
    expect(nextBatchSize(1, 2, 0, null)).toBe(1);
  });

  it('terminates on queue exhaustion, not a page cap', () => {
    expect(nextBatchSize(0, 2, 0, null)).toBe(0);
    expect(nextBatchSize(0, 2, 5, 50)).toBe(0);
  });
});

describe('nextBatchSize — reservation contract', () => {
  it('depends only on the attempted count, independent of redirect aliases in visited', () => {
    // The budget is driven by the reserved attempted count passed in — not by
    // how many redirect-alias URLs a batch added to `visited`. Same attempted
    // count → same reservation regardless of visited-set growth.
    expect(nextBatchSize(10, 4, 48, 50)).toBe(2);
    expect(nextBatchSize(10, 4, 48, 50)).toBe(2);
  });

  it('clamps to the queue length when fewer items are available than the budget', () => {
    expect(nextBatchSize(1, 4, 0, 50)).toBe(1);
    expect(nextBatchSize(0, 4, 0, 50)).toBe(0);
  });
});
