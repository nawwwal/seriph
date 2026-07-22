import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { enqueueImportTask, type ImportTaskPayload } from "../tasks/enqueue";
import { importBatchRef } from "../store/paths";
import { deliverPendingDispatch, pendingDispatch, type PendingImportDispatch } from "./pendingDispatch";

export interface TimeoutSource { ownerId: string; batchId: string; sourceId: string; state: string; updatedAt: number; committedFamilyCount?: number; documentPath?: string; staleBefore?: number; }
export interface TimeoutBatch { ownerId: string; batchId: string; documentPath?: string; pendingDispatch?: PendingImportDispatch | null; }
export interface SourceTimeoutStore {
  listStale(cutoff: number): Promise<TimeoutSource[]>;
  markTimedOut(source: TimeoutSource): Promise<boolean>;
  enqueueReconcile(batch: Pick<TimeoutSource, "ownerId" | "batchId">): Promise<unknown>;
  listStaleBatches?(cutoff: number): Promise<TimeoutBatch[]>;
  recoverStaleBatch?(batch: TimeoutBatch, staleBefore: number): Promise<boolean>;
  listPendingBatches?(): Promise<TimeoutBatch[]>;
  dispatchReconcile?(batch: TimeoutBatch): Promise<unknown>;
}
export interface Clock { now(): number; }
export const DEFAULT_SOURCE_TIMEOUT_MINUTES = 1_440;
export const DEFAULT_BATCH_STALL_MINUTES = 15;
const activeStates = new Set(["registered", "uploading"]);

export async function expireSources(store: SourceTimeoutStore, clock: Clock, timeoutMinutes = DEFAULT_SOURCE_TIMEOUT_MINUTES) {
  const now = clock.now();
  const cutoff = now - timeoutMinutes * 60_000;
  const batchCutoff = now - DEFAULT_BATCH_STALL_MINUTES * 60_000;
  const pending = await store.listPendingBatches?.() ?? [];
  const candidates = await store.listStale(cutoff);
  const batches = new Map(pending.map((batch) => [`${batch.ownerId}/${batch.batchId}`, batch])); let timedOut = 0;
  for (const source of candidates) {
    if (!activeStates.has(source.state) || (source.committedFamilyCount ?? 0) > 0) continue;
    if (await store.markTimedOut({ ...source, staleBefore: cutoff })) {
      timedOut++; batches.set(`${source.ownerId}/${source.batchId}`, { ownerId: source.ownerId, batchId: source.batchId });
    }
  }
  for (const batch of await store.listStaleBatches?.(batchCutoff) ?? []) {
    if (await store.recoverStaleBatch?.(batch, batchCutoff)) batches.set(`${batch.ownerId}/${batch.batchId}`, batch);
  }
  for (const batch of await store.listPendingBatches?.() ?? []) batches.set(`${batch.ownerId}/${batch.batchId}`, batch);
  for (const batch of batches.values()) {
    if (store.dispatchReconcile && batch.pendingDispatch) await store.dispatchReconcile(batch);
    else await store.enqueueReconcile(batch);
  }
  return { timedOut, batchesQueued: batches.size };
}

export interface FirestoreSourceTimeoutDeps { db: Firestore; enqueue?: (task: ImportTaskPayload) => Promise<unknown>; }
const millis = (value: unknown) => typeof value === "number" ? value : value && typeof (value as { toMillis?: () => number }).toMillis === "function" ? (value as { toMillis: () => number }).toMillis() : 0;
const reconcileDispatch = (batch: Pick<TimeoutBatch, "ownerId" | "batchId">): PendingImportDispatch => ({
  token: `reconcile:${batch.batchId}`, task: { kind: "reconcile_batch", ownerId: batch.ownerId, batchId: batch.batchId, resourceId: batch.batchId },
});

export function firestoreSourceTimeoutStore(deps: FirestoreSourceTimeoutDeps): SourceTimeoutStore {
  const enqueue = deps.enqueue ?? ((task) => enqueueImportTask(task));
  return {
    async listStale(cutoff) {
      const snap = await deps.db.collectionGroup("sources").where("state", "in", [...activeStates]).where("updatedAt", "<=", Timestamp.fromMillis(cutoff)).get();
      return snap.docs.flatMap((doc) => {
        const parts = doc.ref.path.split("/"); const data = doc.data();
        if (parts.length !== 6 || parts[0] !== "users" || parts[2] !== "importBatches" || parts[4] !== "sources") return [];
        return [{ ownerId: parts[1]!, batchId: parts[3]!, sourceId: parts[5]!, state: String(data.state), updatedAt: millis(data.updatedAt), committedFamilyCount: Number(data.committedFamilyCount ?? 0), documentPath: doc.ref.path }];
      });
    },
    async listPendingBatches() {
      const snap = await deps.db.collectionGroup("importBatches").where("pendingDispatch.task.kind", "in", ["reconcile_batch", "discover_source", "discover_item", "finalize_plan"]).get();
      return snap.docs.flatMap((doc) => {
        const parts = doc.ref.path.split("/"); const pending = pendingDispatch(doc.data().pendingDispatch);
        return parts.length === 4 && parts[0] === "users" && parts[2] === "importBatches" && pending
          ? [{ ownerId: parts[1]!, batchId: parts[3]!, documentPath: doc.ref.path, pendingDispatch: pending }]
          : [];
      });
    },
    async listStaleBatches(cutoff) {
      const snap = await deps.db.collectionGroup("importBatches").where("outcome", "==", "active").where("updatedAt", "<=", Timestamp.fromMillis(cutoff)).get();
      return snap.docs.flatMap((doc) => {
        const parts = doc.ref.path.split("/");
        return parts.length === 4 && parts[0] === "users" && parts[2] === "importBatches"
          ? [{ ownerId: parts[1]!, batchId: parts[3]!, documentPath: doc.ref.path, pendingDispatch: pendingDispatch(doc.data().pendingDispatch) }]
          : [];
      });
    },
    async recoverStaleBatch(batch, staleBefore) {
      if (!batch.documentPath) return false;
      return deps.db.runTransaction(async (tx) => {
        const ref = deps.db.doc(batch.documentPath!); const snapshot = await tx.get(ref);
        if (!snapshot.exists || snapshot.data()?.outcome !== "active" || millis(snapshot.data()?.updatedAt) > staleBefore) return false;
        if (pendingDispatch(snapshot.data()?.pendingDispatch)) return true;
        const [sources, items, plans] = await Promise.all([tx.get(ref.collection("sources")), tx.get(ref.collection("items")), tx.get(ref.collection("plans").limit(1))]);
        const source = sources.docs.find((doc) => ["uploaded", "discovering"].includes(String(doc.data().state)));
        const item = items.docs.find((doc) => String(doc.data().state) === "discovered");
        const task: ImportTaskPayload | null = source ? { kind: "discover_source", ownerId: batch.ownerId, batchId: batch.batchId, resourceId: source.id, ...(Number.isSafeInteger(source.data().uploadedSize) ? { sourceSize: source.data().uploadedSize } : {}) }
          : item ? { kind: "discover_item", ownerId: batch.ownerId, batchId: batch.batchId, resourceId: item.id, planVersion: 1 }
          : sources.docs.length > 0 && sources.docs.every((doc) => ["discovered", "failed", "canceled", "timed_out"].includes(String(doc.data().state))) && items.docs.length > 0 && items.docs.every((doc) => ["classified", "applied", "duplicate", "review", "discarded", "failed"].includes(String(doc.data().state))) && plans.empty ? { kind: "finalize_plan", ownerId: batch.ownerId, batchId: batch.batchId, resourceId: batch.batchId } : null;
        const pending = task ? { token: `recovery:${task.kind}:${task.resourceId}`, task } : reconcileDispatch(batch);
        batch.pendingDispatch = pending;
        tx.update(ref, task ? { pendingDispatch: pending, recovery: { state: "queued", task: task.kind, updatedAt: FieldValue.serverTimestamp() }, updatedAt: FieldValue.serverTimestamp() } : { outcome: "failed", status: "stalled", failureCode: "stale_batch", stalledAt: FieldValue.serverTimestamp(), reconciliation: { state: "scheduled", requestedAt: FieldValue.serverTimestamp() }, pendingDispatch: pending, updatedAt: FieldValue.serverTimestamp() });
        return true;
      });
    },
    async markTimedOut(source) {
      const staleBefore = source.staleBefore;
      if (!source.documentPath || staleBefore === undefined) return false;
      return deps.db.runTransaction(async (tx) => {
        const ref = deps.db.doc(source.documentPath!); const batch = importBatchRef(deps.db, source.ownerId, source.batchId);
        const [current, batchSnap] = await Promise.all([tx.get(ref), tx.get(batch)]); if (!current.exists || !batchSnap.exists) return false;
        const data = current.data()!; if (!activeStates.has(String(data.state)) || millis(data.updatedAt) > staleBefore || batchSnap.data()?.outcome === "canceled") return false;
        tx.update(ref, { state: "timed_out", updatedAt: FieldValue.serverTimestamp(), timedOutAt: FieldValue.serverTimestamp() });
        tx.update(batch, { reconciliation: { state: "scheduled", requestedAt: FieldValue.serverTimestamp() }, pendingDispatch: reconcileDispatch(source), updatedAt: FieldValue.serverTimestamp() }); return true;
      });
    },
    enqueueReconcile: async (batch) => enqueue({ kind: "reconcile_batch", ownerId: batch.ownerId, batchId: batch.batchId, resourceId: batch.batchId }),
    async dispatchReconcile(batch) {
      if (!batch.documentPath || !batch.pendingDispatch) return;
      await deliverPendingDispatch(deps.db, deps.db.doc(batch.documentPath), batch.pendingDispatch, enqueue);
    },
  };
}
