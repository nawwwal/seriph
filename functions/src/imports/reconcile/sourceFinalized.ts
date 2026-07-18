import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { enqueueImportTask, type ImportTaskPayload } from "../tasks/enqueue";
import { importSourceRef } from "../store/paths";
import { deliverPendingDispatch, pendingDispatch, type PendingImportDispatch } from "./pendingDispatch";

export interface FinalizedObject { name: string; generation: string; size: number; }
export interface RegisteredIntakePath { ownerId: string; batchId: string; sourceId: string; filename: string; storagePath: string; }
export interface RegisteredSource extends Omit<RegisteredIntakePath, "filename"> { state: string; declaredSize?: number; uploadedSize?: number; declaredMimeType?: string; }
export type ConfirmResult = { kind: "ignored" } | { kind: "rejected"; code: "path_mismatch" } |
  { kind: "uploaded" | "already_confirmed"; generation: string };
export interface SourceLifecycleStore {
  load(path: RegisteredIntakePath): Promise<RegisteredSource | null>;
  markUploadedAndEnqueue(source: RegisteredSource, object: FinalizedObject): Promise<ConfirmResult>;
}

export function parseRegisteredIntakePath(name: string, prefix = "intake"): RegisteredIntakePath | null {
  const parts = name.split("/");
  if (parts.length !== 5 || parts.some((part) => !part) || parts[0] !== prefix) return null;
  const [, ownerId, batchId, sourceId, filename] = parts;
  return { ownerId, batchId, sourceId, filename, storagePath: name };
}

export async function confirmFinalizedSource(object: FinalizedObject, store: SourceLifecycleStore, intakePrefix = "intake"): Promise<ConfirmResult> {
  const path = parseRegisteredIntakePath(object.name, intakePrefix);
  if (!path) return { kind: "ignored" };
  const source = await store.load(path);
  if (!source || source.storagePath !== object.name) return { kind: "rejected", code: "path_mismatch" };
  return store.markUploadedAndEnqueue(source, object);
}

export interface FirestoreSourceLifecycleDeps { db: Firestore; enqueue?: (task: ImportTaskPayload) => Promise<unknown>; }
type TransactionResult = { result: ConfirmResult; pending: PendingImportDispatch | null };

function sourceDispatch(source: RegisteredSource, generation: string, size: number): PendingImportDispatch {
  return { token: `source:${source.sourceId}:${generation}`, task: {
    kind: "discover_source", ownerId: source.ownerId, batchId: source.batchId, resourceId: source.sourceId,
    sourceSize: size,
  } };
}

export function firestoreSourceLifecycleStore(deps: FirestoreSourceLifecycleDeps): SourceLifecycleStore {
  const enqueue = deps.enqueue ?? ((task) => enqueueImportTask(task));
  return {
    async load(path) {
      const snap = await importSourceRef(deps.db, path.ownerId, path.batchId, path.sourceId).get();
      const data = snap.data() as Partial<RegisteredSource> | undefined;
      return snap.exists && data?.state ? { ...path, ...data, state: data.state } : null;
    },
    async markUploadedAndEnqueue(source, object) {
      const ref = importSourceRef(deps.db, source.ownerId, source.batchId, source.sourceId);
      const committed = await deps.db.runTransaction<TransactionResult>(async (tx) => {
        const snap = await tx.get(ref); if (!snap.exists) return { result: { kind: "ignored" as const }, pending: null };
        const current = snap.data() as Record<string, unknown>;
        if (current.storagePath !== object.name) return { result: { kind: "rejected", code: "path_mismatch" as const }, pending: null };
        const existing = pendingDispatch(current.pendingDispatch);
        if (existing) return { result: { kind: "already_confirmed" as const, generation: String(current.uploadGeneration ?? object.generation) }, pending: existing };
        if (current.uploadGeneration === object.generation || !["registered", "uploading"].includes(String(current.state))) {
          return { result: { kind: "already_confirmed" as const, generation: String(current.uploadGeneration ?? object.generation) }, pending: null };
        }
        const pending = sourceDispatch(source, object.generation, object.size);
        tx.update(ref, { state: "uploaded", uploadConfirmed: true, uploadGeneration: object.generation,
          uploadedSize: object.size, pendingDispatch: pending, updatedAt: FieldValue.serverTimestamp() });
        return { result: { kind: "uploaded" as const, generation: object.generation }, pending };
      });
      if (committed.pending) await deliverPendingDispatch(deps.db, ref, committed.pending, enqueue);
      return committed.result;
    },
  };
}
