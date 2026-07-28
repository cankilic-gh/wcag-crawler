interface ScanJob {
  scanId: string;
  run: () => Promise<void>;
  cancelActive: () => void;
  resolve: () => void;
  reject: (error: unknown) => void;
}

export class ScanJobScheduler {
  private readonly queue: ScanJob[] = [];
  private active: ScanJob | null = null;
  private draining = false;

  enqueue(
    scanId: string,
    run: () => Promise<void>,
    cancelActive: () => void,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.queue.push({ scanId, run, cancelActive, resolve, reject });
      void this.drain();
    });
  }

  cancel(scanId: string): boolean {
    if (this.active?.scanId === scanId) {
      this.active.cancelActive();
      return true;
    }

    const queuedIndex = this.queue.findIndex(job => job.scanId === scanId);
    if (queuedIndex < 0) return false;

    const [queued] = this.queue.splice(queuedIndex, 1);
    queued.resolve();
    return true;
  }

  has(scanId: string): boolean {
    return this.active?.scanId === scanId || this.queue.some(job => job.scanId === scanId);
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.queue.length > 0) {
        const job = this.queue.shift()!;
        this.active = job;
        try {
          await job.run();
          job.resolve();
        } catch (error) {
          job.reject(error);
        } finally {
          this.active = null;
        }
      }
    } finally {
      this.draining = false;
      if (this.queue.length > 0) void this.drain();
    }
  }
}

export const scanJobScheduler = new ScanJobScheduler();
