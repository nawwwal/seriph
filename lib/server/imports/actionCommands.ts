import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { RetryTarget } from '@/models/import-batch.models';

export type { RetryTarget } from '@/models/import-batch.models';
export type ActionTargetKind = RetryTarget['kind'];
export interface ImportActionCommand { ownerId: string; batchId: string; idempotencyKey: string; target: RetryTarget; }
export interface CancelImportBatchCommand { ownerId: string; batchId: string; idempotencyKey: string; }
export interface ImportBatchActionTarget { ownerId: string; batchId: string; kind: ActionTargetKind; id: string; state: string; attempts?: number; maxAttempts?: number; retryable?: boolean; leaseExpiresAt?: unknown; applied?: boolean; [key: string]: unknown; }
export interface ImportStageTask { taskId: string; stage: ActionTargetKind; ownerId: string; batchId: string; resourceId: string; target: RetryTarget; attempt: number; idempotencyKey: string; }
export type ActionConflictCode = 'already_applied' | 'already_queued' | 'attempts_exhausted' | 'batch_missing' | 'idempotency_conflict' | 'lease_active' | 'not_retryable' | 'target_not_found';
export type RetryActionResult = { kind: 'queued' | 'existing'; task: ImportStageTask } | { kind: 'conflict'; code: ActionConflictCode };
export type CancelActionResult = { kind: 'canceled' | 'existing'; appliedFamilyIds: string[] } | { kind: 'conflict'; code: 'batch_missing' | 'idempotency_conflict' };

export interface ImportActionTransaction {
  getBatch(ownerId: string, batchId: string): Promise<Record<string, unknown> | null>;
  getTarget(ownerId: string, batchId: string, target: { kind: ActionTargetKind; id: string }): Promise<ImportBatchActionTarget | null>;
  listTargets(ownerId: string, batchId: string, kind: ActionTargetKind): Promise<ImportBatchActionTarget[]>;
  getReceipt(ownerId: string, key: string): Promise<{ fingerprint: string; result: RetryActionResult | CancelActionResult } | null>;
  setReceipt(ownerId: string, key: string, value: { fingerprint: string; result: RetryActionResult | CancelActionResult }): Promise<void>;
  updateTarget(target: ImportBatchActionTarget, patch: Record<string, unknown>): Promise<void>;
  updateBatch(ownerId: string, batchId: string, patch: Record<string, unknown>): Promise<void>;
  enqueue(task: ImportStageTask): Promise<void>;
}
export interface ImportActionStore { transaction<T>(run: (tx: ImportActionTransaction) => Promise<T>): Promise<T>; }

const targetId = (target: RetryTarget) => target.kind === 'source' ? target.sourceId : target.kind === 'item' ? target.itemId : target.kind === 'family' ? target.familyPlanId : target.jobId;
const targetRef = (target: RetryTarget) => ({ kind: target.kind, id: targetId(target) });
const fingerprint = (command: ImportActionCommand | CancelImportBatchCommand) => JSON.stringify({ ownerId: command.ownerId, batchId: command.batchId, target: 'target' in command ? command.target : null });
const conflict = (code: ActionConflictCode): RetryActionResult => ({ kind: 'conflict', code });
const applied = (target: ImportBatchActionTarget) => target.applied === true || ['applied', 'committed', 'duplicate'].includes(target.state);
const date = (value: unknown): Date | null => { if (value instanceof Date) return value; if (typeof value === 'string' || typeof value === 'number') { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? null : parsed; } if (value && typeof (value as { toDate?: unknown }).toDate === 'function') return date((value as { toDate: () => unknown }).toDate()); return null; };
const stage = (target: RetryTarget): ActionTargetKind => target.kind;

export async function retryImportTarget(store: ImportActionStore, command: ImportActionCommand, now = new Date()): Promise<RetryActionResult> {
  return store.transaction(async (tx) => {
    const key = await tx.getReceipt(command.ownerId, command.idempotencyKey); const mark = fingerprint(command);
    if (key) return key.fingerprint === mark ? { kind: 'existing', task: (key.result as { task: ImportStageTask }).task } : conflict('idempotency_conflict');
    if (!(await tx.getBatch(command.ownerId, command.batchId))) return conflict('batch_missing');
    const target = await tx.getTarget(command.ownerId, command.batchId, targetRef(command.target));
    if (!target || target.ownerId !== command.ownerId || target.batchId !== command.batchId) return conflict('target_not_found');
    if (applied(target)) return conflict('already_applied');
    if (target.state === 'retrying') return conflict('already_queued');
    if (!['failed', 'error', 'timed_out', 'retryable'].includes(target.state)) return conflict('not_retryable');
    if (!target.retryable && (target as { error?: { retryable?: unknown } }).error?.retryable !== true) return conflict('not_retryable');
    const attempts = target.attempts ?? 0; if (attempts >= (target.maxAttempts ?? 3)) return conflict('attempts_exhausted');
    const lease = date(target.leaseExpiresAt); if (lease && lease > now) return conflict('lease_active');
    const task: ImportStageTask = { taskId: `${command.batchId}:${command.target.kind}:${target.id}`, stage: stage(command.target), ownerId: command.ownerId, batchId: command.batchId, resourceId: target.id, target: command.target, attempt: attempts + 1, idempotencyKey: command.idempotencyKey };
    await tx.updateTarget(target, { state: 'retrying', attempts: task.attempt, leaseExpiresAt: null, retryTaskId: task.taskId }); await tx.enqueue(task);
    const result: RetryActionResult = { kind: 'queued', task }; await tx.setReceipt(command.ownerId, command.idempotencyKey, { fingerprint: mark, result }); return result;
  });
}

const cancelable = (target: ImportBatchActionTarget) => !applied(target) && target.state !== 'canceled';
export async function cancelImportBatch(store: ImportActionStore, command: CancelImportBatchCommand): Promise<CancelActionResult> {
  return store.transaction(async (tx) => {
    const key = await tx.getReceipt(command.ownerId, command.idempotencyKey); const mark = fingerprint(command);
    if (key) return key.fingerprint === mark ? { kind: 'existing', appliedFamilyIds: (key.result as Extract<CancelActionResult, { appliedFamilyIds: string[] }>).appliedFamilyIds } : { kind: 'conflict', code: 'idempotency_conflict' };
    if (!(await tx.getBatch(command.ownerId, command.batchId))) return { kind: 'conflict', code: 'batch_missing' };
    const groups = await Promise.all((['source', 'item', 'family', 'enrichment'] as const).map((kind) => tx.listTargets(command.ownerId, command.batchId, kind)));
    const all = groups.flat(); const appliedFamilyIds = all.filter((target) => target.kind === 'family' && applied(target)).map((target) => String(target.familyPlanId ?? target.id));
    for (const target of all) if (cancelable(target)) await tx.updateTarget(target, { state: 'canceled', canceledAt: new Date().toISOString() });
    await tx.updateBatch(command.ownerId, command.batchId, { outcome: 'canceled', canceledAt: new Date().toISOString() });
    const result: CancelActionResult = { kind: 'canceled', appliedFamilyIds }; await tx.setReceipt(command.ownerId, command.idempotencyKey, { fingerprint: mark, result }); return result;
  });
}

const ownerRef = (db: Firestore, ownerId: string) => db.collection('users').doc(ownerId);
const batchRef = (db: Firestore, ownerId: string, batchId: string) => ownerRef(db, ownerId).collection('importBatches').doc(batchId);
const collectionFor = (kind: ActionTargetKind) => kind === 'source' ? 'sources' : kind === 'item' ? 'items' : kind === 'family' ? 'familyPlans' : 'enrichmentJobs';
const docRef = (db: Firestore, ownerId: string, batchId: string, target: { kind: ActionTargetKind; id: string }) => batchRef(db, ownerId, batchId).collection(collectionFor(target.kind)).doc(target.id);
export function createFirestoreImportActionStore(db: Firestore): ImportActionStore {
  return { transaction: (run) => db.runTransaction(async (tx) => run({
    getBatch: async (ownerId, batchId) => { const snap = await tx.get(batchRef(db, ownerId, batchId)); return snap.exists ? { ownerId, batchId, ...snap.data() } : null; },
    getTarget: async (ownerId, batchId, target) => { const snap = await tx.get(docRef(db, ownerId, batchId, target)); return snap.exists ? { ownerId, batchId, kind: target.kind, id: target.id, ...snap.data() } as ImportBatchActionTarget : null; },
    listTargets: async (ownerId, batchId, kind) => { const snap = await tx.get(batchRef(db, ownerId, batchId).collection(collectionFor(kind))); return snap.docs.map((doc) => ({ ownerId, batchId, kind, id: doc.id, ...doc.data() }) as ImportBatchActionTarget); },
    getReceipt: async (ownerId, key) => { const snap = await tx.get(ownerRef(db, ownerId).collection('importBatchActionReceipts').doc(Buffer.from(key).toString('base64url'))); return snap.exists ? snap.data() as { fingerprint: string; result: RetryActionResult | CancelActionResult } : null; },
    setReceipt: async (ownerId, key, value) => { tx.set(ownerRef(db, ownerId).collection('importBatchActionReceipts').doc(Buffer.from(key).toString('base64url')), { ...value, createdAt: FieldValue.serverTimestamp() }); },
    updateTarget: async (target, patch) => { tx.update(docRef(db, target.ownerId, target.batchId, target), { ...patch, updatedAt: FieldValue.serverTimestamp() }); },
    updateBatch: async (ownerId, batchId, patch) => { tx.update(batchRef(db, ownerId, batchId), { ...patch, updatedAt: FieldValue.serverTimestamp() }); },
    enqueue: async (task) => { tx.set(batchRef(db, task.ownerId, task.batchId).collection('actionTasks').doc(task.taskId.replaceAll('/', '_')), { ...task, status: 'queued', createdAt: FieldValue.serverTimestamp() }, { merge: true }); },
  })) };
}
