import { FieldValue, type DocumentReference, type Firestore } from "firebase-admin/firestore";
import type { ImportTaskPayload } from "../tasks/enqueue";

export interface PendingImportDispatch { token: string; task: ImportTaskPayload; }
type Enqueue = (task: ImportTaskPayload) => Promise<unknown>;

export function pendingDispatch(value: unknown): PendingImportDispatch | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { token?: unknown; task?: Partial<ImportTaskPayload> };
  const task = candidate.task;
  return typeof candidate.token === "string" && typeof task?.kind === "string" &&
    typeof task.ownerId === "string" && typeof task.batchId === "string" && typeof task.resourceId === "string"
    ? { token: candidate.token, task: task as ImportTaskPayload }
    : null;
}

export function samePendingDispatch(left: unknown, right: PendingImportDispatch): boolean {
  const current = pendingDispatch(left);
  return current?.token === right.token && JSON.stringify(current.task) === JSON.stringify(right.task);
}

export async function deliverPendingDispatch(
  db: Firestore, ref: DocumentReference, pending: PendingImportDispatch, enqueue: Enqueue,
): Promise<void> {
  await enqueue(pending.task);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists && samePendingDispatch(snap.data()?.pendingDispatch, pending)) {
      tx.update(ref, { pendingDispatch: null, dispatchQueuedAt: FieldValue.serverTimestamp() });
    }
  });
}
