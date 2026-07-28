import { describe, expect, it } from 'vitest';
import { ScanJobScheduler } from '../src/services/scan-job-scheduler.js';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

describe('ScanJobScheduler', () => {
  it('runs jobs FIFO with at most one active job', async () => {
    const scheduler = new ScanJobScheduler();
    const first = deferred();
    const events: string[] = [];
    let active = 0;
    let maxActive = 0;

    const one = scheduler.enqueue('one', async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      events.push('one:start');
      await first.promise;
      events.push('one:end');
      active -= 1;
    }, () => {});
    const two = scheduler.enqueue('two', async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      events.push('two:start');
      active -= 1;
    }, () => {});

    await Promise.resolve();
    expect(events).toEqual(['one:start']);
    first.resolve();
    await Promise.all([one, two]);
    expect(events).toEqual(['one:start', 'one:end', 'two:start']);
    expect(maxActive).toBe(1);
  });

  it('continues the queue after a job fails', async () => {
    const scheduler = new ScanJobScheduler();
    const events: string[] = [];
    const failed = scheduler.enqueue('bad', async () => { throw new Error('fixture failure'); }, () => {});
    const next = scheduler.enqueue('next', async () => { events.push('next'); }, () => {});

    await expect(failed).rejects.toThrow('fixture failure');
    await next;
    expect(events).toEqual(['next']);
  });

  it('cancels only the matching active or queued job', async () => {
    const scheduler = new ScanJobScheduler();
    const first = deferred();
    const cancelled: string[] = [];
    const ran: string[] = [];

    const one = scheduler.enqueue('one', async () => { await first.promise; }, () => { cancelled.push('one'); first.resolve(); });
    const two = scheduler.enqueue('two', async () => { ran.push('two'); }, () => { cancelled.push('two'); });

    await Promise.resolve();
    expect(scheduler.has('one')).toBe(true);
    expect(scheduler.has('two')).toBe(true);
    expect(scheduler.cancel('missing')).toBe(false);
    expect(scheduler.cancel('two')).toBe(true);
    expect(scheduler.has('two')).toBe(false);
    expect(scheduler.cancel('one')).toBe(true);
    expect(scheduler.has('one')).toBe(true);
    await Promise.all([one, two]);

    expect(cancelled).toEqual(['one']);
    expect(ran).toEqual([]);
    expect(scheduler.has('one')).toBe(false);
  });
});
