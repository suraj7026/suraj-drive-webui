export type UploadJob = {
  id: string;
  size: number;
  transfer: () => Promise<(() => Promise<void>) | void>;
};

type PendingJob = UploadJob & { resolve: () => void; reject: (error: unknown) => void };

// Reserve processing capacity before transferring bytes, so slow verification
// cannot create an unbounded backlog. A file above the byte budget runs alone.
export class UploadQueue {
  private pending: PendingJob[] = [];
  private admitted = new Set<string>();
  private transferring = 0;
  private processingBytes = 0;

  constructor(private readonly limits = { transfers: 3, files: 6, bytes: 64 * 1024 ** 3 }) {}

  enqueue(job: UploadJob): Promise<void> {
    if (this.admitted.has(job.id) || this.pending.some((entry) => entry.id === job.id)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.pending.push({ ...job, resolve, reject });
      this.pump();
    });
  }

  cancelPending(id?: string) {
    this.pending = this.pending.filter((job) => {
      if (id !== undefined && id !== job.id) return true;
      job.resolve();
      return false;
    });
  }

  private pump() {
    while (this.pending.length && this.transferring < this.limits.transfers && this.admitted.size < this.limits.files) {
      const job = this.pending[0];
      if (this.admitted.size > 0 && this.processingBytes + job.size > this.limits.bytes) return;
      this.pending.shift();
      this.admitted.add(job.id);
      this.processingBytes += job.size;
      this.transferring++;
      void this.run(job);
    }
  }

  private async run(job: PendingJob) {
    let released = false;
    try {
      const process = await job.transfer();
      this.transferring--;
      released = true;
      this.pump();
      await process?.();
      job.resolve();
    } catch (error) {
      job.reject(error);
    } finally {
      if (!released) this.transferring--;
      this.admitted.delete(job.id);
      this.processingBytes -= job.size;
      this.pump();
    }
  }
}
