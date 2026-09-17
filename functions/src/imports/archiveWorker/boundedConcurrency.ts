export const ARCHIVE_CHILD_CONCURRENCY = 8;

interface QueuedTask {
  task: () => Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
}

/**
 * Runs archive child durability work with a hard upper bound and backpressure.
 * Tasks already started are allowed to settle before the first failure escapes.
 */
export function createArchiveChildPool(limit = ARCHIVE_CHILD_CONCURRENCY) {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("archive child concurrency must be a positive integer");
  let active = 0;
  let firstError: unknown;
  const queue: QueuedTask[] = [];
  const idleWaiters: Array<() => void> = [];

  const settleIdle = () => {
    if (active !== 0 || queue.length !== 0) return;
    while (idleWaiters.length) idleWaiters.shift()!();
  };

  const start = (queued: QueuedTask) => {
    active += 1;
    queued.resolve();
    void queued.task().catch((error: unknown) => {
      firstError ??= error;
    }).finally(() => {
      active -= 1;
      pump();
      settleIdle();
    });
  };

  const pump = () => {
    if (firstError) {
      while (queue.length) queue.shift()!.reject(firstError);
      settleIdle();
      return;
    }
    while (active < limit && queue.length) start(queue.shift()!);
    settleIdle();
  };

  return {
    add(task: () => Promise<void>): Promise<void> {
      if (firstError) return Promise.reject(firstError);
      return new Promise<void>((resolve, reject) => {
        queue.push({ task, resolve, reject });
        pump();
      });
    },
    async drain(): Promise<void> {
      if (active !== 0 || queue.length !== 0) await new Promise<void>((resolve) => idleWaiters.push(resolve));
      if (firstError) throw firstError;
    },
  };
}
