/**
 * Pure crawl batch-budget calculator.
 *
 * The crawler launches pages in concurrent batches. To avoid overshooting the
 * page cap, each batch reserves an *attempted-page* budget atomically before
 * launching: the batch size is bounded by the queue length, the effective
 * concurrency, and the remaining budget.
 *
 * The budget is driven by an `attempted` counter incremented before each batch
 * launches — independent of the `visited` set, which also grows with redirect
 * alias URLs and would otherwise miscount the reservation.
 *
 * - `maxPages === null` (admin): unlimited — bounded only by queue/concurrency,
 *   so the crawl terminates on queue exhaustion.
 * - finite `maxPages`: the batch is restricted to exactly the remaining budget,
 *   never launching more than `maxPages - attempted` pages.
 */
export function nextBatchSize(
  queueLength: number,
  concurrency: number,
  attempted: number,
  maxPages: number | null,
): number {
  if (queueLength <= 0 || concurrency <= 0) return 0;
  const byConcurrency = Math.min(queueLength, concurrency);
  if (maxPages === null) return byConcurrency;
  const remaining = maxPages - attempted;
  if (remaining <= 0) return 0;
  return Math.min(byConcurrency, remaining);
}
