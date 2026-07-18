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
  listPendingBatches?(): Promise<TimeoutBatch[]>;
  dispatchReconcile?(batch: TimeoutBatch): Promise<unknown>;
}
export interface Clock { now(): number; }
export const DEFAULT_SOURCE_TIMEOUT_MINUTES = 1_440;
const activeStates = new Set(["registered", "uploading"]);

export async function expireSources(store: SourceTimeoutStore, clock: Clock, timeoutMinutes = DEFAULT_SOURCE_TIMEOUT_MINUTES) {
  const cutoff = clock.now() - timeoutMinutes * 60_000;
  const pending = await store.listPendingBatches?.() ?? [];
  const candidates = await store.listStale(cutoff);
  const batches = new Map(pending.map((batch) => [`${batch.ownerId}/${batch.batchId}`, batch])); let timedOut = 0;
  for (const source of candidates) {
    if (!activeStates.has(source.state) || (source.committedFamilyCount ?? 0) > 0) continue;
    if (await store.markTimedOut({ ...source, staleBefore: cutoff })) {
      timedOut++; batches.set(`${source.ownerId}/${source.batchId}`, { ownerId: source.ownerId, batchId: source.batchId });
    }
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
      const snap = await deps.db.collectionGroup("importBatches").where("pendingDispatch.task.kind", "==", "reconcile_batch").get();
      return snap.docs.flatMap((doc) => {
        const parts = doc.ref.path.split("/"); const pending = pendingDispatch(doc.data().pendingDispatch);
        return parts.length === 4 && parts[0] === "users" && parts[2] === "importBatches" && pending
          ? [{ ownerId: parts[1]!, batchId: parts[3]!, documentPath: doc.ref.path, pendingDispatch: pending }]
          : [];
      });
    },
    async markTimedOut(source) {
      const staleBefore = source.staleBefore;
      if (!source.documentPath || staleBefore === undefined) return false;
      return deps.db.runTransaction(async (tx) => {
        const ref = deps.db.doc(source.documentPath!); const batch = importBatchRef(deps.db, source.ownerId, source.batchId);
        const [current, batchSnap] = await Promise.all([tx.get(ref), tx.get(batch)]); if (!current.exists || !batchSnap.exists) return false;
        const data = current.data()!; if (!activeStates.has(String(data.state)) || millis(data.updatedAt) > staleBefore) return false;
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
