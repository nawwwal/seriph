import type { Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { serverParseFontFile } from "../../parser/fontParser";
import { importBatchRef, importSourceRef } from "../store/paths";
import { importItemRef } from "../store/itemStore";
import { readinessWithDelta, terminalItemState, terminalSourceState } from "../store/batchStore";
import type { ImportTaskPayload } from "../tasks/enqueue";
import { isMissingStorageObject } from "../tasks/cancellation";
import { deliverPendingDispatch, type PendingImportDispatch } from "../reconcile/pendingDispatch";
import type { PlanInventoryItem } from "./buildPlan";

type Row = Record<string, unknown>;
type Enqueue = (payload: ImportTaskPayload) => Promise<unknown>;

export class MissingSourceObjectError extends Error {
  constructor(readonly itemId: string, readonly sourceId?: string) { super("source_object_missing"); }
}

export async function parsedItem(item: Row, sourcePath: string): Promise<PlanInventoryItem | null> {
  let bytes: Buffer;
  try { bytes = (await getStorage().bucket().file(sourcePath).download())[0]; }
  catch (error) {
    if (isMissingStorageObject(error)) throw new MissingSourceObjectError(String(item.itemId), typeof item.sourceId === "string" ? item.sourceId : undefined);
    throw error;
  }
  const metadata = await serverParseFontFile(bytes, String(item.filename));
  if (!metadata) return null;
  return { ...item, ...metadata, itemId: String(item.itemId), ownerId: String(item.ownerId), batchId: String(item.batchId), sha256: String(item.sha256) };
}

export function discoveredItem(item: Row): PlanInventoryItem {
  const metadata = item.fontMetadata;
  if (!metadata || typeof metadata !== "object") throw new Error(`font_metadata_missing:${String(item.itemId)}`);
  return { ...item, ...(metadata as Record<string, unknown>), itemId: String(item.itemId), ownerId: String(item.ownerId), batchId: String(item.batchId), sha256: String(item.sha256) } as PlanInventoryItem;
}

export async function failPlanningTerminally(db: Firestore, payload: ImportTaskPayload, code: string, enqueue: Enqueue, missing: { itemId?: string; sourceId?: string } = {}): Promise<void> {
  const batch = importBatchRef(db, payload.ownerId, payload.batchId);
  const item = missing.itemId ? importItemRef(db, payload.ownerId, payload.batchId, missing.itemId) : undefined;
  const source = missing.sourceId ? importSourceRef(db, payload.ownerId, payload.batchId, missing.sourceId) : undefined;
  const observedAtMs = Date.now();
  const pending: PendingImportDispatch = { token: `reconcile:${payload.batchId}:${observedAtMs}`, task: { kind: "reconcile_batch", ownerId: payload.ownerId, batchId: payload.batchId, resourceId: payload.batchId, observedAtMs } };
  const scheduled = await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(batch);
    if (!snapshot.exists || snapshot.data()?.outcome === "canceled") return false;
    const [itemSnapshot, sourceSnapshot] = await Promise.all([item ? tx.get(item) : Promise.resolve(undefined), source ? tx.get(source) : Promise.resolve(undefined)]);
    const data = snapshot.data() as Row; const phases = (data.phases as Row | undefined) ?? {}; const planning = (phases.planning as Row | undefined) ?? {};
    const error = { code, message: code, phase: "planning", retryable: false };
    const itemCanFail = Boolean(itemSnapshot?.exists && !["applied", "duplicate", "review", "discarded", "failed"].includes(String(itemSnapshot.data()?.state)));
    const sourceCanFail = Boolean(sourceSnapshot?.exists && !["failed", "canceled", "timed_out"].includes(String(sourceSnapshot.data()?.state)));
    const itemPending = Boolean(itemCanFail && !terminalItemState(itemSnapshot?.data()?.state));
    const sourcePending = Boolean(sourceCanFail && !terminalSourceState(sourceSnapshot?.data()?.state));
    if (itemCanFail) tx.update(item!, { state: "failed", error, updatedAt: new Date() });
    if (sourceCanFail) tx.update(source!, { state: "failed", error, updatedAt: new Date() });
    const readiness = readinessWithDelta(data.readiness, { pendingItems: itemPending ? -1 : 0, pendingSources: sourcePending ? -1 : 0 });
    tx.update(batch, { phases: { ...phases, planning: { ...planning, state: "failed", error, updatedAt: new Date() } }, reconciliation: { state: "scheduled", requestedAt: new Date() }, pendingDispatch: pending, ...(readiness ? { readiness } : {}), updatedAt: new Date() });
    return true;
  });
  if (!scheduled) return;
  try { await deliverPendingDispatch(db, batch, pending, enqueue); } catch { /* pendingDispatch remains for scheduled recovery */ }
}
