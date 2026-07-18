import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { enqueueImportTask, type ImportTaskPayload } from "../tasks/enqueue";
import { importBatchRef } from "../store/paths";

export interface TimeoutSource { ownerId: string; batchId: string; sourceId: string; state: string; updatedAt: number; committedFamilyCount?: number; documentPath?: string; staleBefore?: number; }
export interface SourceTimeoutStore {
  listStale(cutoff: number): Promise<TimeoutSource[]>;
  markTimedOut(source: TimeoutSource): Promise<boolean>;
  enqueueReconcile(batch: Pick<TimeoutSource, "ownerId" | "batchId">): Promise<unknown>;
}
export interface Clock { now(): number; }
export const DEFAULT_SOURCE_TIMEOUT_MINUTES = 1_440;
const activeStates = new Set(["registered", "uploading"]);

export async function expireSources(store: SourceTimeoutStore, clock: Clock, timeoutMinutes = DEFAULT_SOURCE_TIMEOUT_MINUTES) {
  const cutoff = clock.now() - timeoutMinutes * 60_000;
  const candidates = await store.listStale(cutoff);
  const batches = new Set<string>(); let timedOut = 0;
  for (const source of candidates) {
    if (!activeStates.has(source.state) || (source.committedFamilyCount ?? 0) > 0) continue;
    if (await store.markTimedOut({ ...source, staleBefore: cutoff })) { timedOut++; batches.add(`${source.ownerId}/${source.batchId}`); }
  }
  for (const key of batches) { const [ownerId, batchId] = key.split("/"); await store.enqueueReconcile({ ownerId, batchId }); }
  return { timedOut, batchesQueued: batches.size };
}

export interface FirestoreSourceTimeoutDeps { db: Firestore; enqueue?: (task: ImportTaskPayload) => Promise<unknown>; }
const millis = (value: unknown) => typeof value === "number" ? value : value && typeof (value as { toMillis?: () => number }).toMillis === "function" ? (value as { toMillis: () => number }).toMillis() : 0;

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
    async markTimedOut(source) {
      const staleBefore = source.staleBefore;
      if (!source.documentPath || staleBefore === undefined) return false;
      return deps.db.runTransaction(async (tx) => {
        const ref = deps.db.doc(source.documentPath!); const batch = importBatchRef(deps.db, source.ownerId, source.batchId);
        const [current, batchSnap] = await Promise.all([tx.get(ref), tx.get(batch)]); if (!current.exists || !batchSnap.exists) return false;
        const data = current.data()!; if (!activeStates.has(String(data.state)) || millis(data.updatedAt) > staleBefore) return false;
        tx.update(ref, { state: "timed_out", updatedAt: FieldValue.serverTimestamp(), timedOutAt: FieldValue.serverTimestamp() });
        tx.update(batch, { reconciliation: { state: "scheduled", requestedAt: FieldValue.serverTimestamp() }, updatedAt: FieldValue.serverTimestamp() }); return true;
      });
    },
    enqueueReconcile: async (batch) => enqueue({ kind: "reconcile_batch", ownerId: batch.ownerId, batchId: batch.batchId, resourceId: batch.batchId }),
  };
}
