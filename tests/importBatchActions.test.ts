import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  cancelImportBatch,
  retryImportTarget,
  type ImportActionStore,
  type ImportActionTransaction,
  type ImportBatchActionTarget,
  type RetryActionResult,
  type CancelActionResult,
} from '@/lib/server/imports/actionCommands';
import { parseRetryBody } from '@/app/api/v1/import-batches/[batchId]/actions/retry/route';

class FakeStore implements ImportActionStore, ImportActionTransaction {
  batches = new Map<string, Record<string, unknown>>(); targets: ImportBatchActionTarget[] = [];
  receipts = new Map<string, { fingerprint: string; result: RetryActionResult | CancelActionResult }>(); tasks: unknown[] = []; familyVersions: unknown[] = []; enqueueFailure: Error | null = null;
  transaction<T>(run: (tx: ImportActionTransaction) => Promise<T>) { return run(this); }
  async getBatch(ownerId: string, batchId: string) { return this.batches.get(`${ownerId}/${batchId}`) ?? null; }
  async getTarget(ownerId: string, batchId: string, target: { kind: string; id: string }, planVersion?: number) { if (target.kind === 'family') this.familyVersions.push(planVersion); return this.targets.find((row) => row.ownerId === ownerId && row.batchId === batchId && row.kind === target.kind && row.id === target.id) ?? null; }
  async listTargets(ownerId: string, batchId: string, kind: ImportBatchActionTarget['kind']) { return this.targets.filter((row) => row.ownerId === ownerId && row.batchId === batchId && row.kind === kind); }
  async getReceipt(ownerId: string, key: string) { return this.receipts.get(`${ownerId}/${key}`) ?? null; }
  async setReceipt(ownerId: string, key: string, value: { fingerprint: string; result: RetryActionResult | CancelActionResult }) { this.receipts.set(`${ownerId}/${key}`, value); }
  async updateTarget(target: ImportBatchActionTarget, patch: Record<string, unknown>) { Object.assign(target, patch); }
  async updateBatch(ownerId: string, batchId: string, patch: Record<string, unknown>) { Object.assign(this.batches.get(`${ownerId}/${batchId}`)!, patch); }
  async enqueue(task: unknown) { if (this.enqueueFailure) throw this.enqueueFailure; this.tasks.push(task); }
}

const command = { ownerId: 'u1', batchId: 'b1', idempotencyKey: 'retry-1', target: { kind: 'item' as const, itemId: 'i1' } };
const item = (state = 'failed', extra: Record<string, unknown> = {}): ImportBatchActionTarget => ({ ownerId: 'u1', batchId: 'b1', kind: 'item', id: 'i1', state, attempts: 0, retryable: true, ...extra });

describe('import batch actions', () => {
  it('queues a failed retryable target and is idempotent', async () => {
    const store = new FakeStore(); store.batches.set('u1/b1', {}); store.targets = [item()];
    await expect(retryImportTarget(store, command)).resolves.toMatchObject({ kind: 'queued' });
    await expect(retryImportTarget(store, command)).resolves.toMatchObject({ kind: 'existing' });
    expect(store.tasks).toHaveLength(1); expect(store.targets[0]).toMatchObject({ state: 'discovered', attempts: 1 });
  });

  it('uses canonical durable worker payloads for source and plan-backed family retries', async () => {
    const store = new FakeStore(); store.batches.set('u1/b1', { planVersion: 2 }); store.targets = [{ ...item(), kind: 'source', id: 's1', sourceId: 's1' }, { ...item(), kind: 'family', id: 'f1', familyPlanId: 'f1', planVersion: 2, payload: { kind: 'apply_family', ownerId: 'u1', batchId: 'b1', resourceId: 'f1', planVersion: 2 } }];
    await retryImportTarget(store, { ...command, idempotencyKey: 'source', target: { kind: 'source', sourceId: 's1' } });
    await retryImportTarget(store, { ...command, idempotencyKey: 'family', target: { kind: 'family', familyPlanId: 'f1' } });
    expect(store.tasks).toEqual([{ kind: 'discover_source', ownerId: 'u1', batchId: 'b1', resourceId: 's1' }, { kind: 'apply_family', ownerId: 'u1', batchId: 'b1', resourceId: 'f1', planVersion: 2 }]);
    expect(store.familyVersions).toEqual([2]);
  });

  it('redelivers the canonical worker task when the original enqueue failed', async () => {
    const store = new FakeStore(); store.batches.set('u1/b1', {}); store.targets = [item()]; store.enqueueFailure = new Error('queue unavailable');
    await expect(retryImportTarget(store, command)).rejects.toThrow('queue unavailable'); store.enqueueFailure = null;
    await expect(retryImportTarget(store, command)).resolves.toMatchObject({ kind: 'existing' }); expect(store.tasks).toEqual([{ kind: 'discover_item', ownerId: 'u1', batchId: 'b1', resourceId: 'i1' }]);
  });

  it('never retries an applied family', async () => {
    const store = new FakeStore(); store.batches.set('u1/b1', { planVersion: 1 }); store.targets = [{ ...item(), kind: 'family', id: 'family-1', familyPlanId: 'family-1', state: 'applied' }];
    await expect(retryImportTarget(store, { ...command, idempotencyKey: 'family-1', target: { kind: 'family', familyPlanId: 'family-1' } }))
      .resolves.toEqual({ kind: 'conflict', code: 'already_applied' });
  });

  it('cancels uncommitted targets while reporting applied family IDs', async () => {
    const store = new FakeStore(); store.batches.set('u1/b1', { outcome: 'active' }); store.targets = [item(), { ...item(), id: 'f1', kind: 'family', familyPlanId: 'f1', state: 'applied' }];
    await expect(cancelImportBatch(store, { ownerId: 'u1', batchId: 'b1', idempotencyKey: 'cancel-1' })).resolves.toMatchObject({ kind: 'canceled', appliedFamilyIds: ['f1'] });
    expect(store.targets).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'i1', state: 'canceled' }), expect.objectContaining({ id: 'f1', state: 'applied' })]));
  });

  it('does not mutate terminal batches and reports already-applied plan tasks', async () => {
    const store = new FakeStore(); store.batches.set('u1/b1', { outcome: 'succeeded', planVersion: 2 }); store.targets = [item(), { ...item(), id: 'f1', kind: 'family', familyPlanId: 'f1', state: 'applied', status: 'applied', planVersion: 2 }];
    await expect(cancelImportBatch(store, { ownerId: 'u1', batchId: 'b1', idempotencyKey: 'terminal' })).resolves.toEqual({ kind: 'conflict', code: 'terminal_batch' });
    expect(store.targets[0]).toMatchObject({ state: 'failed' }); expect(store.batches.get('u1/b1')).toMatchObject({ outcome: 'succeeded' });
  });

  it('returns the applied plan task report for an already-canceled batch without writing children', async () => {
    const store = new FakeStore(); store.batches.set('u1/b1', { outcome: 'canceled', planVersion: 2 }); store.targets = [{ ...item(), id: 'f1', kind: 'family', familyPlanId: 'f1', state: 'applied', status: 'applied', planVersion: 2 }];
    await expect(cancelImportBatch(store, { ownerId: 'u1', batchId: 'b1', idempotencyKey: 'canceled' })).resolves.toEqual({ kind: 'existing', appliedFamilyIds: ['f1'] });
    expect(store.targets[0]).toMatchObject({ state: 'applied', status: 'applied' });
  });

  it('fails before mutating when cancel would exceed the transaction write budget', async () => {
    const store = new FakeStore(); store.batches.set('u1/b1', { outcome: 'active' }); store.targets = Array.from({ length: 451 }, (_, index) => ({ ...item(), id: `i${index}` }));
    await expect(cancelImportBatch(store, { ownerId: 'u1', batchId: 'b1', idempotencyKey: 'large' })).resolves.toEqual({ kind: 'conflict', code: 'cancel_limit_exceeded' });
    expect(store.targets.every((target) => target.state === 'failed')).toBe(true); expect(store.batches.get('u1/b1')).toMatchObject({ outcome: 'active' });
  });

  it('fails closed before queueing malformed retry attempts and leases', async () => {
    for (const extra of [{ attempts: Number.NaN }, { attempts: '1' }, { maxAttempts: Number.NaN }, { leaseExpiresAt: 'nope' }, { leaseExpiresAt: Number.NaN }]) {
      const store = new FakeStore(); store.batches.set('u1/b1', {}); store.targets = [item('failed', extra)];
      await expect(retryImportTarget(store, command)).resolves.toEqual({ kind: 'conflict', code: 'invalid_retry_state' }); expect(store.tasks).toEqual([]);
    }
  });

  it('keeps the target contract strict and exposes recovery guidance', () => {
    expect(parseRetryBody({ target: { kind: 'item', itemId: 'i1' } })).toEqual({ kind: 'item', itemId: 'i1' });
    expect(parseRetryBody({ target: { kind: 'item', itemId: 'i1', ignored: true } })).toBeNull();
    expect(fs.readFileSync('components/import/ImportWorkspace.tsx', 'utf8')).toContain('Reselect');
  });
});
