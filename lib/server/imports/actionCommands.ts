import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { canonicalizeImportTaskPayload, enqueueImportTask, importTaskName, type ImportTaskPayload } from '@/functions/src/imports/tasks/enqueue';
import type { RetryTarget } from '@/models/import-batch.models';

export type { RetryTarget } from '@/models/import-batch.models';
export type ActionTargetKind = RetryTarget['kind'];
export interface ImportActionCommand { ownerId: string; batchId: string; idempotencyKey: string; target: RetryTarget; }
export interface CancelImportBatchCommand { ownerId: string; batchId: string; idempotencyKey: string; }
export interface ImportBatchActionTarget { ownerId: string; batchId: string; kind: ActionTargetKind; id: string; state: string; attempts?: unknown; maxAttempts?: unknown; retryable?: boolean; leaseExpiresAt?: unknown; applied?: boolean; planVersion?: number; [key: string]: unknown; }
export interface ImportStageTask { taskId: string; payload: ImportTaskPayload; }
export type ActionConflictCode = 'already_applied' | 'attempts_exhausted' | 'batch_missing' | 'idempotency_conflict' | 'invalid_retry_state' | 'lease_active' | 'not_retryable' | 'target_not_found' | 'terminal_batch' | 'unsupported_target';
export type RetryActionResult = { kind: 'queued' | 'existing'; task: ImportStageTask } | { kind: 'conflict'; code: ActionConflictCode };
export type CancelActionResult = { kind: 'canceled' | 'existing'; appliedFamilyIds: string[] } | { kind: 'conflict'; code: 'batch_missing' | 'idempotency_conflict' | 'terminal_batch' };
export interface ImportActionReceipt { fingerprint: string; result: RetryActionResult | CancelActionResult; delivered?: boolean; }
export interface ImportActionTransaction {
  getBatch(ownerId: string, batchId: string): Promise<Record<string, unknown> | null>;
  getTarget(ownerId: string, batchId: string, target: { kind: ActionTargetKind; id: string }, planVersion?: number): Promise<ImportBatchActionTarget | null>;
  listTargets(ownerId: string, batchId: string, kind: ActionTargetKind, planVersion?: number): Promise<ImportBatchActionTarget[]>;
  getReceipt(ownerId: string, key: string): Promise<ImportActionReceipt | null>;
  setReceipt(ownerId: string, key: string, value: ImportActionReceipt): Promise<void>;
  updateTarget(target: ImportBatchActionTarget, patch: Record<string, unknown>): Promise<void>;
  updateBatch(ownerId: string, batchId: string, patch: Record<string, unknown>): Promise<void>;
}
export interface ImportActionStore { transaction<T>(run: (tx: ImportActionTransaction) => Promise<T>): Promise<T>; enqueue(task: ImportTaskPayload): Promise<unknown>; }

const id = (target: RetryTarget) => target.kind === 'source' ? target.sourceId : target.kind === 'item' ? target.itemId : target.kind === 'family' ? target.familyPlanId : target.jobId;
const ref = (target: RetryTarget) => ({ kind: target.kind, id: id(target) });
const fingerprint = (command: ImportActionCommand | CancelImportBatchCommand) => JSON.stringify({ ownerId: command.ownerId, batchId: command.batchId, target: 'target' in command ? command.target : null });
const conflict = (code: ActionConflictCode): RetryActionResult => ({ kind: 'conflict', code });
const applied = (target: ImportBatchActionTarget) => target.applied === true || ['applied', 'committed', 'duplicate'].includes(target.state);
const integer = (value: unknown, fallback: number) => value === undefined ? fallback : Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : null;
const version = (value: unknown) => Number.isSafeInteger(value) && (value as number) > 0 ? value as number : null;
const lease = (value: unknown): Date | null | undefined => value === undefined || value === null ? null : value instanceof Date ? Number.isNaN(value.getTime()) ? undefined : value : typeof value === 'number' && Number.isFinite(value) ? new Date(value) : typeof value === 'string' && value.trim() ? (() => { const date = new Date(value); return Number.isNaN(date.getTime()) ? undefined : date; })() : value && typeof (value as { toDate?: unknown }).toDate === 'function' ? lease((value as { toDate: () => unknown }).toDate()) : undefined;
const payload = (target: ImportBatchActionTarget, command: ImportActionCommand): ImportTaskPayload | null => {
  try {
    const plain: unknown = target.kind === 'source' ? { kind: 'discover_source', ownerId: command.ownerId, batchId: command.batchId, resourceId: target.id } : target.kind === 'item' ? { kind: 'discover_item', ownerId: command.ownerId, batchId: command.batchId, resourceId: target.id } : target.kind === 'family' ? target.payload : null;
    const task = plain === null ? null : canonicalizeImportTaskPayload(plain); return task && task.ownerId === command.ownerId && task.batchId === command.batchId && task.resourceId === target.id && (target.kind !== 'family' || task.kind === 'apply_family' && task.planVersion === target.planVersion) ? task : null;
  } catch { return null; }
};
const reset = (target: ImportBatchActionTarget, attempts: number) => target.kind === 'source' ? { state: 'uploaded', retryCount: attempts, leaseExpiresAt: null } : target.kind === 'item' ? { state: 'discovered', attempts, leaseExpiresAt: null } : { state: 'pending', status: 'pending', attempts, leaseExpiresAt: null };

export async function retryImportTarget(store: ImportActionStore, command: ImportActionCommand, now = new Date()): Promise<RetryActionResult> {
  let deliver = false;
  const result = await store.transaction<RetryActionResult>(async (tx) => {
    const receipt = await tx.getReceipt(command.ownerId, command.idempotencyKey); const mark = fingerprint(command);
    if (receipt) { if (receipt.fingerprint !== mark) return conflict('idempotency_conflict'); deliver = !receipt.delivered; return { kind: 'existing', task: (receipt.result as { task: ImportStageTask }).task }; }
    const batch = await tx.getBatch(command.ownerId, command.batchId); if (!batch) return conflict('batch_missing');
    const planVersion = command.target.kind === 'family' ? version(batch.planVersion) : undefined; if (command.target.kind === 'family' && !planVersion) return conflict('invalid_retry_state');
    const target = await tx.getTarget(command.ownerId, command.batchId, ref(command.target), planVersion ?? undefined);
    if (!target || target.ownerId !== command.ownerId || target.batchId !== command.batchId) return conflict('target_not_found');
    if (applied(target)) return conflict('already_applied');
    if (!['failed', 'error', 'timed_out'].includes(target.state) || (!target.retryable && (target as { error?: { retryable?: unknown } }).error?.retryable !== true)) return conflict('not_retryable');
    const attempts = integer(target.attempts, 0); const max = integer(target.maxAttempts, 3); const expires = lease(target.leaseExpiresAt); if (attempts === null || max === null || expires === undefined) return conflict('invalid_retry_state');
    if (attempts >= max) return conflict('attempts_exhausted'); if (expires && expires > now) return conflict('lease_active');
    const taskPayload = payload(target, command); if (!taskPayload) return conflict(command.target.kind === 'enrichment' ? 'unsupported_target' : 'invalid_retry_state');
    const task: ImportStageTask = { taskId: importTaskName(taskPayload), payload: taskPayload }; await tx.updateTarget(target, reset(target, attempts + 1)); const queued: RetryActionResult = { kind: 'queued', task };
    await tx.setReceipt(command.ownerId, command.idempotencyKey, { fingerprint: mark, result: queued, delivered: false }); deliver = true; return queued;
  });
  if (result.kind === 'conflict' || !deliver) return result; await store.enqueue(result.task.payload);
  await store.transaction(async (tx) => { const receipt = await tx.getReceipt(command.ownerId, command.idempotencyKey); if (receipt?.fingerprint === fingerprint(command)) await tx.setReceipt(command.ownerId, command.idempotencyKey, { ...receipt, delivered: true }); }); return result;
}

const terminal = new Set(['succeeded', 'partial', 'needs_review', 'failed', 'canceled']);
const ids = (targets: ImportBatchActionTarget[]) => [...new Set(targets.filter((target) => target.kind === 'family' && applied(target)).map((target) => String(target.familyPlanId ?? target.id)))].sort();
export async function cancelImportBatch(store: ImportActionStore, command: CancelImportBatchCommand, now = new Date()): Promise<CancelActionResult> {
  return store.transaction(async (tx) => {
    const receipt = await tx.getReceipt(command.ownerId, command.idempotencyKey); const mark = fingerprint(command);
    if (receipt) return receipt.fingerprint === mark ? { kind: 'existing', appliedFamilyIds: (receipt.result as Extract<CancelActionResult, { appliedFamilyIds: string[] }>).appliedFamilyIds } : { kind: 'conflict', code: 'idempotency_conflict' };
    const batch = await tx.getBatch(command.ownerId, command.batchId); if (!batch) return { kind: 'conflict', code: 'batch_missing' }; const planVersion = version(batch.planVersion);
    if (terminal.has(String(batch.outcome))) return String(batch.outcome) === 'canceled' ? { kind: 'existing', appliedFamilyIds: ids(planVersion ? await tx.listTargets(command.ownerId, command.batchId, 'family', planVersion) : []) } : { kind: 'conflict', code: 'terminal_batch' };
    const families = planVersion ? await tx.listTargets(command.ownerId, command.batchId, 'family', planVersion) : [];
    await tx.updateBatch(command.ownerId, command.batchId, { outcome: 'canceled', canceledAt: now.toISOString() }); const result: CancelActionResult = { kind: 'canceled', appliedFamilyIds: ids(families) };
    await tx.setReceipt(command.ownerId, command.idempotencyKey, { fingerprint: mark, result }); return result;
  });
}

const owner = (db: Firestore, ownerId: string) => db.collection('users').doc(ownerId); const batch = (db: Firestore, ownerId: string, batchId: string) => owner(db, ownerId).collection('importBatches').doc(batchId);
const doc = (db: Firestore, ownerId: string, batchId: string, target: { kind: ActionTargetKind; id: string }, planVersion?: number) => target.kind === 'family' && planVersion ? batch(db, ownerId, batchId).collection('plans').doc(String(planVersion)).collection('applyTasks').doc(target.id) : target.kind === 'family' ? null : batch(db, ownerId, batchId).collection(target.kind === 'source' ? 'sources' : target.kind === 'item' ? 'items' : 'enrichmentJobs').doc(target.id);
const mapped = (data: Record<string, unknown>, ownerId: string, batchId: string, kind: ActionTargetKind, id: string, planVersion?: number): ImportBatchActionTarget => ({ ...data, ownerId, batchId, kind, id, state: String(data.status ?? data.state ?? ''), attempts: kind === 'source' ? data.retryCount : data.attempts, planVersion });
export function createFirestoreImportActionStore(db: Firestore): ImportActionStore {
  return { transaction: (run) => db.runTransaction(async (tx) => run({
    getBatch: async (ownerId, batchId) => { const snap = await tx.get(batch(db, ownerId, batchId)); return snap.exists ? { ...snap.data() } : null; },
    getTarget: async (ownerId, batchId, target, planVersion) => { const ref = doc(db, ownerId, batchId, target, planVersion); const snap = ref && await tx.get(ref); return snap?.exists ? mapped((snap.data() ?? {}) as Record<string, unknown>, ownerId, batchId, target.kind, target.id, planVersion) : null; },
    listTargets: async (ownerId, batchId, kind, planVersion) => { const parent = kind === 'family' && planVersion ? batch(db, ownerId, batchId).collection('plans').doc(String(planVersion)).collection('applyTasks') : kind === 'family' ? null : batch(db, ownerId, batchId).collection(kind === 'source' ? 'sources' : kind === 'item' ? 'items' : 'enrichmentJobs'); if (!parent) return []; const snap = await tx.get(parent); return snap.docs.map((row) => mapped(row.data(), ownerId, batchId, kind, row.id, planVersion)); },
    getReceipt: async (ownerId, key) => { const snap = await tx.get(owner(db, ownerId).collection('importBatchActionReceipts').doc(Buffer.from(key).toString('base64url'))); return snap.exists ? snap.data() as ImportActionReceipt : null; },
    setReceipt: async (ownerId, key, value) => { tx.set(owner(db, ownerId).collection('importBatchActionReceipts').doc(Buffer.from(key).toString('base64url')), { ...value, createdAt: FieldValue.serverTimestamp() }); },
    updateTarget: async (target, patch) => { const ref = doc(db, target.ownerId, target.batchId, target, target.planVersion); if (ref) tx.update(ref, { ...patch, updatedAt: FieldValue.serverTimestamp() }); },
    updateBatch: async (ownerId, batchId, patch) => { tx.update(batch(db, ownerId, batchId), { ...patch, updatedAt: FieldValue.serverTimestamp() }); },
  })), enqueue: (task) => enqueueImportTask(task) };
}
