import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createBatchFeedController,
  type BatchFeedListener,
  type BatchFeedPage,
  type BatchFeedState,
} from '@/lib/hooks/useImportBatchFeed';
import {
  createImportBatchChildrenController,
  type ImportBatchChildrenListener,
} from '@/lib/hooks/useImportBatchChildren';
import { mapImportBatch, type ImportBatchSummary } from '@/lib/imports/mapImportBatch';

const activeBatch = (families = 0): ImportBatchSummary => ({
  batchId: 'b1',
  ownerId: 'user-a',
  label: 'July import',
  expectedSourceCount: 2,
  outcome: 'active',
  counters: { sources: 2, discoveredItems: 2, fonts: 1, families, duplicates: 0, review: 0, warnings: 0, failures: 0 },
  phases: {},
  createdAt: 1_000,
  updatedAt: 2_000,
});

const completeBatch: ImportBatchSummary = {
  ...activeBatch(1),
  outcome: 'succeeded',
  updatedAt: 3_000,
};

function listenerHarness() {
  let activeRows: (rows: unknown[]) => void = () => undefined;
  let terminalRows: (rows: unknown[]) => void = () => undefined;
  let listenerError: (error: unknown) => void = () => undefined;
  const listener: BatchFeedListener = {
    subscribeActive(rows, error) {
      activeRows = rows;
      listenerError = error;
      return () => undefined;
    },
    subscribeTerminal(rows) {
      terminalRows = rows;
      return () => undefined;
    },
  };
  return { listener, activeRows: (rows: unknown[]) => activeRows(rows), terminalRows: (rows: unknown[]) => terminalRows(rows), fail: (error: unknown) => listenerError(error) };
}

describe('durable import batch feed', () => {
  afterEach(() => vi.useRealTimers());

  it('keeps terminal batches and falls back to the API when the listener fails', async () => {
    const harness = listenerHarness();
    const fallback: BatchFeedPage = { batches: [completeBatch], nextCursor: 'older-page' };
    const list = vi.fn(async () => fallback);
    const states: BatchFeedState[] = [];
    const controller = createBatchFeedController({
      listener: harness.listener,
      api: { list },
      onChange: (state) => states.push(state),
    });

    controller.start();
    expect(list).not.toHaveBeenCalled();
    harness.fail(new Error('permission-denied'));
    await vi.waitFor(() => expect(list).toHaveBeenCalledWith(null));

    expect(states.at(-1)?.batches).toEqual([completeBatch]);
    expect(states.at(-1)?.transport).toBe('polling');
    expect(states.at(-1)?.nextCursor).toBe('older-page');
  });

  it('fires catalogue invalidation when the applied-family count increases', () => {
    const harness = listenerHarness();
    const events: Array<{ kind: string; batchId: string; delta: number }> = [];
    const controller = createBatchFeedController({
      listener: harness.listener,
      api: { list: async () => ({ batches: [], nextCursor: null }) },
      onCompletion: (event) => events.push(event),
    });

    controller.start();
    harness.activeRows([activeBatch(1)]);
    harness.activeRows([{ ...activeBatch(1), counters: { ...activeBatch(1).counters, families: 2 } }]);

    expect(events).toContainEqual({ kind: 'families_applied', batchId: 'b1', delta: 1 });
  });

  it('pages older history without dropping the API cursor', async () => {
    const harness = listenerHarness();
    const list = vi.fn()
      .mockResolvedValueOnce({ batches: [completeBatch], nextCursor: 'page-2' })
      .mockResolvedValueOnce({ batches: [{ ...completeBatch, batchId: 'b0', updatedAt: 1_000 }], nextCursor: null });
    const controller = createBatchFeedController({
      listener: harness.listener,
      api: { list },
      onChange: () => undefined,
    });

    controller.start();
    harness.fail(new Error('permission-denied'));
    await vi.waitFor(() => expect(list).toHaveBeenCalledWith(null));
    await controller.loadOlder();

    expect(list).toHaveBeenLastCalledWith('page-2');
  });

  it('starts polling only after listener failure', async () => {
    vi.useFakeTimers();
    const harness = listenerHarness();
    const list = vi.fn(async () => ({ batches: [completeBatch], nextCursor: null }));
    const controller = createBatchFeedController({
      listener: harness.listener,
      api: { list },
      onChange: () => undefined,
    });

    controller.start();
    await vi.advanceTimersByTimeAsync(8_000);
    expect(list).not.toHaveBeenCalled();
    harness.fail(new Error('listener unavailable'));
    await vi.waitFor(() => expect(list).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(8_000);
    expect(list).toHaveBeenCalledTimes(2);
    controller.stop();
  });
});

describe('durable import child status', () => {
  it('subscribes lazily on expansion and unsubscribes on collapse', async () => {
    const subscriptions: Array<{ kind: string; rows: (rows: unknown[]) => void; stop: ReturnType<typeof vi.fn> }> = [];
    const listener: ImportBatchChildrenListener = {
      subscribe(_batchId, kind, rows) {
        const subscription = { kind, rows, stop: vi.fn() };
        subscriptions.push(subscription);
        return subscription.stop;
      },
    };
    const controller = createImportBatchChildrenController({ listener });
    const pending = controller.loadChildren('b1');

    expect(subscriptions.map(({ kind }) => kind)).toEqual(['familyPlans', 'reviewItems']);
    subscriptions.find(({ kind }) => kind === 'familyPlans')?.rows([{ id: 'plan-1', state: 'ready' }]);
    subscriptions.find(({ kind }) => kind === 'reviewItems')?.rows([{ id: 'review-1', state: 'needs_review' }]);
    await expect(pending).resolves.toMatchObject({
      familyPlans: [{ id: 'plan-1', state: 'ready' }],
      reviewItems: [{ id: 'review-1', state: 'needs_review' }],
    });

    controller.collapse('b1');
    expect(subscriptions.every(({ stop }) => stop.mock.calls.length === 1)).toBe(true);
  });
});

describe('import batch runtime mapping', () => {
  it('rejects malformed snapshots and normalizes valid terminal snapshots', () => {
    expect(mapImportBatch({ batchId: 'b1', outcome: 'succeeded' })).toBeNull();
    expect(mapImportBatch({
      batchId: 'b1',
      ownerId: 'user-a',
      label: 'July import',
      expectedSourceCount: 2,
      outcome: 'succeeded',
      counters: { families: 1 },
      createdAt: { toMillis: () => 1_000 },
      updatedAt: { toMillis: () => 2_000 },
    })).toMatchObject({ batchId: 'b1', outcome: 'succeeded', counters: { families: 1 }, updatedAt: 2_000 });
  });
});
