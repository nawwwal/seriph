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
  receipts = new Map<string, { fingerprint: string; result: RetryActionResult | CancelActionResult }>(); tasks: unknown[] = [];
  transaction<T>(run: (tx: ImportActionTransaction) => Promise<T>) { return run(this); }
  async getBatch(ownerId: string, batchId: string) { return this.batches.get(`${ownerId}/${batchId}`) ?? null; }
  async getTarget(ownerId: string, batchId: string, target: { kind: string; id: string }) { return this.targets.find((row) => row.ownerId === ownerId && row.batchId === batchId && row.kind === target.kind && row.id === target.id) ?? null; }
  async listTargets(ownerId: string, batchId: string, kind: ImportBatchActionTarget['kind']) { return this.targets.filter((row) => row.ownerId === ownerId && row.batchId === batchId && row.kind === kind); }
  async getReceipt(ownerId: string, key: string) { return this.receipts.get(`${ownerId}/${key}`) ?? null; }
  async setReceipt(ownerId: string, key: string, value: { fingerprint: string; result: RetryActionResult | CancelActionResult }) { this.receipts.set(`${ownerId}/${key}`, value); }
  async updateTarget(target: ImportBatchActionTarget, patch: Record<string, unknown>) { Object.assign(target, patch); }
  async updateBatch(ownerId: string, batchId: string, patch: Record<string, unknown>) { Object.assign(this.batches.get(`${ownerId}/${batchId}`)!, patch); }
  async enqueue(task: unknown) { this.tasks.push(task); }
}

const command = { ownerId: 'u1', batchId: 'b1', idempotencyKey: 'retry-1', target: { kind: 'item' as const, itemId: 'i1' } };
const item = (state = 'failed', extra: Record<string, unknown> = {}): ImportBatchActionTarget => ({ ownerId: 'u1', batchId: 'b1', kind: 'item', id: 'i1', state, attempts: 0, retryable: true, ...extra });

describe('import batch actions', () => {
  it('queues a failed retryable target and is idempotent', async () => {
    const store = new FakeStore(); store.batches.set('u1/b1', {}); store.targets = [item()];
    await expect(retryImportTarget(store, command)).resolves.toMatchObject({ kind: 'queued' });
    await expect(retryImportTarget(store, command)).resolves.toMatchObject({ kind: 'existing' });
    expect(store.tasks).toHaveLength(1); expect(store.targets[0]).toMatchObject({ state: 'retrying', attempts: 1 });
  });

  it('never retries an applied family', async () => {
    const store = new FakeStore(); store.batches.set('u1/b1', {}); store.targets = [{ ...item(), kind: 'family', id: 'family-1', familyPlanId: 'family-1', state: 'applied' }];
    await expect(retryImportTarget(store, { ...command, idempotencyKey: 'family-1', target: { kind: 'family', familyPlanId: 'family-1' } }))
      .resolves.toEqual({ kind: 'conflict', code: 'already_applied' });
  });

  it('cancels uncommitted targets while reporting applied family IDs', async () => {
    const store = new FakeStore(); store.batches.set('u1/b1', { outcome: 'active' }); store.targets = [item(), { ...item(), id: 'f1', kind: 'family', familyPlanId: 'f1', state: 'applied' }];
    await expect(cancelImportBatch(store, { ownerId: 'u1', batchId: 'b1', idempotencyKey: 'cancel-1' })).resolves.toMatchObject({ kind: 'canceled', appliedFamilyIds: ['f1'] });
    expect(store.targets).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'i1', state: 'canceled' }), expect.objectContaining({ id: 'f1', state: 'applied' })]));
  });

  it('keeps the target contract strict and exposes recovery guidance', () => {
    expect(parseRetryBody({ target: { kind: 'item', itemId: 'i1' } })).toEqual({ kind: 'item', itemId: 'i1' });
    expect(parseRetryBody({ target: { kind: 'item', itemId: 'i1', ignored: true } })).toBeNull();
    expect(fs.readFileSync('components/import/ImportWorkspace.tsx', 'utf8')).toContain('Reselect');
  });
});
