import { afterEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({ subscriptions: [] as Array<{ next: (snapshot: unknown) => void }>, queries: [] as Array<{ constraints: unknown[] }> }));
vi.mock('@/lib/firebase/config', () => ({ db: 'fake-db' }));
vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => ({ args }),
  where: (...args: unknown[]) => ({ kind: 'where', args }),
  orderBy: (...args: unknown[]) => ({ kind: 'orderBy', args }),
  limit: (value: number) => ({ kind: 'limit', value }),
  Timestamp: { fromMillis: (value: number) => ({ kind: 'timestamp', value }) },
  query: (_root: unknown, ...constraints: unknown[]) => { const value = { constraints }; fake.queries.push(value); return value; },
  onSnapshot: (target: { constraints: unknown[] }, next: (snapshot: unknown) => void) => { fake.subscriptions.push({ next }); return () => undefined; },
}));

import { createFirestoreBatchFeedListener } from '@/lib/imports/importBatchFeedAdapters';
import { createBatchFeedController } from '@/lib/imports/importBatchFeedController';

const terminal = { batchId: 'b-terminal', ownerId: 'u1', label: 'Terminal', expectedSourceCount: 1, outcome: 'succeeded', counters: { families: 1 }, updatedAt: 3_000 };

describe('constructed durable import listeners', () => {
  afterEach(() => vi.useRealTimers());

  it('delivers terminal Firestore rows into the merged feed without API fallback', () => {
    fake.queries.length = 0; fake.subscriptions.length = 0;
    const listener = createFirestoreBatchFeedListener('u1'); const list = vi.fn(async () => ({ batches: [], nextCursor: null })); const states: Array<{ batches: Array<{ batchId: string }> }> = [];
    const controller = createBatchFeedController({ listener, api: { list }, onChange: (state) => states.push(state) }); controller.start();
    fake.subscriptions[1]?.next({ docs: [{ id: terminal.batchId, data: () => terminal }] });
    expect(states.at(-1)?.batches).toMatchObject([terminal]); expect(list).not.toHaveBeenCalled();
  });

  it('constructs active and terminal queries with the required bounds', () => {
    vi.useFakeTimers(); vi.setSystemTime(1_000_000); fake.queries.length = 0; createFirestoreBatchFeedListener('u1');
    const terminalQuery = fake.queries[1];
    expect(terminalQuery.constraints).toEqual(expect.arrayContaining([
      { kind: 'where', args: ['outcome', 'in', ['succeeded', 'partial', 'needs_review', 'failed', 'canceled']] },
      { kind: 'orderBy', args: ['updatedAt', 'desc'] },
      { kind: 'limit', value: 100 },
    ]));
    const whereClauses = terminalQuery.constraints.filter((constraint) => (constraint as { kind?: string }).kind === 'where') as Array<{ args: unknown[] }>;
    expect(whereClauses[0].args[0]).toBe('outcome');
    expect(whereClauses[1].args).toEqual(['updatedAt', '>=', { kind: 'timestamp', value: 1_000_000 - 30 * 24 * 60 * 60 * 1_000 }]);
    expect(fake.queries[0].constraints).toContainEqual({ kind: 'limit', value: 100 });
  });
});
