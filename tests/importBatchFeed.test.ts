import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBatchFeedController, type BatchFeedListener, type BatchFeedPage, type BatchFeedState } from '@/lib/hooks/useImportBatchFeed';
import type { ImportBatchSummary } from '@/lib/imports/mapImportBatch';

const batch = (id = 'b1', families = 0): ImportBatchSummary => ({ batchId: id, ownerId: 'user-a', label: 'July import', expectedSourceCount: 2, outcome: 'active', counters: { sources: 2, discoveredItems: 2, fonts: 1, families, duplicates: 0, review: 0, warnings: 0, failures: 0 }, phases: {}, createdAt: 1_000, updatedAt: 2_000 });
const complete = { ...batch(), outcome: 'succeeded' as const, updatedAt: 3_000, counters: { ...batch().counters, families: 1 } };

function harness() {
  let active: (rows: unknown[]) => void = () => undefined;
  let terminal: (rows: unknown[]) => void = () => undefined;
  let fail: (error: unknown) => void = () => undefined;
  const listener: BatchFeedListener = {
    subscribeActive(rows, error) { active = rows; fail = error; return () => undefined; },
    subscribeTerminal(rows) { terminal = rows; return () => undefined; },
  };
  return { listener, active: (rows: unknown[]) => active(rows), terminal: (rows: unknown[]) => terminal(rows), fail: (error: unknown) => fail(error) };
}

describe('durable import batch feed', () => {
  afterEach(() => vi.useRealTimers());

  it('keeps terminal batches and falls back to the API after listener failure', async () => {
    const fake = harness(); const page: BatchFeedPage = { batches: [complete], nextCursor: 'page-2' }; const list = vi.fn(async () => page); const states: BatchFeedState[] = [];
    const controller = createBatchFeedController({ listener: fake.listener, api: { list }, onChange: (state) => states.push(state) });
    controller.start(); fake.fail(new Error('permission-denied')); await vi.waitFor(() => expect(list).toHaveBeenCalledWith(null));
    expect(states.at(-1)).toMatchObject({ batches: [complete], transport: 'polling', nextCursor: 'page-2' });
  });

  it('invalidates catalogue only when applied-family count increases', () => {
    const fake = harness(); const events: unknown[] = []; const controller = createBatchFeedController({ listener: fake.listener, api: { list: async () => ({ batches: [], nextCursor: null }) }, onCompletion: (event) => events.push(event) });
    controller.start(); fake.active([batch('b1', 1)]); fake.active([batch('b1', 2)]); fake.active([batch('b1', 1)]);
    expect(events).toEqual([{ kind: 'families_applied', batchId: 'b1', delta: 1 }]);
  });

  it('preserves the older-history cursor across eight-second fallback refreshes', async () => {
    vi.useFakeTimers(); const fake = harness(); const list = vi.fn().mockResolvedValueOnce({ batches: [complete], nextCursor: 'page-2' }).mockResolvedValueOnce({ batches: [{ ...complete, batchId: 'b0' }], nextCursor: 'page-3' }).mockResolvedValue({ batches: [complete], nextCursor: 'page-2' });
    const states: BatchFeedState[] = []; const controller = createBatchFeedController({ listener: fake.listener, api: { list }, onChange: (state) => states.push(state) });
    controller.start(); fake.fail(new Error('listener unavailable')); await vi.waitFor(() => expect(list).toHaveBeenCalledTimes(1)); await controller.loadOlder();
    await vi.advanceTimersByTimeAsync(8_000); await vi.waitFor(() => expect(list).toHaveBeenCalledTimes(3));
    expect(states.at(-1)?.nextCursor).toBe('page-3'); expect(states.at(-1)?.batches.map((item) => item.batchId)).toContain('b0'); controller.stop();
  });

  it('does not poll before failure and polls every eight seconds after failure', async () => {
    vi.useFakeTimers(); const fake = harness(); const list = vi.fn(async () => ({ batches: [complete], nextCursor: null })); const controller = createBatchFeedController({ listener: fake.listener, api: { list }, onChange: () => undefined });
    controller.start(); await vi.advanceTimersByTimeAsync(8_000); expect(list).not.toHaveBeenCalled(); fake.fail(new Error('unavailable')); await vi.waitFor(() => expect(list).toHaveBeenCalledTimes(1)); await vi.advanceTimersByTimeAsync(8_000); expect(list).toHaveBeenCalledTimes(2); controller.stop();
  });
});
