import { describe, expect, it } from 'vitest';
import { createDetailPrefetchQueue } from '@/lib/cache/familyDetailPrefetchQueue';

function deferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('detail prefetch queue', () => {
  it('runs at most two unique intent prefetches concurrently', async () => {
    const queue = createDetailPrefetchQueue(2);
    const first = deferred();
    const second = deferred();
    const third = deferred();
    const started: string[] = [];
    queue.enqueue('first', async () => { started.push('first'); await first.promise; });
    queue.enqueue('second', async () => { started.push('second'); await second.promise; });
    queue.enqueue('third', async () => { started.push('third'); await third.promise; });

    expect(started).toEqual(['first', 'second']);
    first.resolve();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(started).toEqual(['first', 'second', 'third']);
    second.resolve();
    third.resolve();
  });

  it('dedupes repeated same-ID intent without substituting another family', async () => {
    const queue = createDetailPrefetchQueue(2);
    const first = deferred();
    const requested: string[] = [];
    queue.enqueue('user-a:abc-ginto-normal', async () => {
      requested.push('abc-ginto-normal');
      await first.promise;
    });
    queue.enqueue('user-a:abc-ginto-normal', async () => {
      requested.push('abc-ginto-nord');
    });

    expect(requested).toEqual(['abc-ginto-normal']);
    first.resolve();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(requested).toEqual(['abc-ginto-normal']);
  });
});
