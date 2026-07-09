type PrefetchTask = () => Promise<void>;

export function createDetailPrefetchQueue(limit: number) {
  const queued: Array<{ key: string; task: PrefetchTask }> = [];
  const known = new Set<string>();
  let active = 0;
  const run = () => {
    while (active < limit && queued.length > 0) {
      const next = queued.shift()!;
      active += 1;
      void next.task().finally(() => {
        active -= 1;
        known.delete(next.key);
        run();
      });
    }
  };
  return {
    enqueue(key: string, task: PrefetchTask): void {
      if (known.has(key)) return;
      known.add(key);
      queued.push({ key, task });
      run();
    },
  };
}

export const familyDetailPrefetchQueue = createDetailPrefetchQueue(2);
