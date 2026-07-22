import type { Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { serverParseFontFile } from "../../parser/fontParser";
import { claimAsset } from "../store/assetClaimStore";
import { enqueuePendingPlanTasks, saveValidatedPlan } from "../store/planStore";
import { importBatchRef, importSourceRef } from "../store/paths";
import { importItemRef } from "../store/itemStore";
import { enqueueImportTask, type ImportTaskPayload } from "../tasks/enqueue";
import { isImportBatchCanceled, isMissingStorageObject } from "../tasks/cancellation";
import { deliverPendingDispatch, type PendingImportDispatch } from "../reconcile/pendingDispatch";
import { buildImportPlan, type ImportPlan, type PlanInventoryItem } from "./buildPlan";

type Row = Record<string, unknown>;
type Enqueue = (payload: ImportTaskPayload) => Promise<unknown>;
export interface FinalizePlanDependencies { enqueueReconcile?: Enqueue; }
const terminalSource = new Set(["discovered", "failed", "canceled", "timed_out"]);
const terminalItem = new Set(["classified", "applied", "duplicate", "review", "discarded", "failed"]);

function isReady(sources: readonly Row[], items: readonly Row[]): boolean {
  return sources.length > 0 && sources.every((source) => terminalSource.has(String(source.state)))
    && items.length > 0 && items.every((item) => terminalItem.has(String(item.state)));
}

/** Queue planning only after every source and inventory item has a durable terminal state. */
export async function requestPlanFinalization(db: Firestore, ownerId: string, batchId: string, enqueue: Enqueue): Promise<boolean> {
  const batch = importBatchRef(db, ownerId, batchId);
  if (await isImportBatchCanceled(db, ownerId, batchId)) return false;
  const [sources, items] = await Promise.all([batch.collection("sources").get(), batch.collection("items").get()]);
  if (!isReady(sources.docs.map((doc) => doc.data()), items.docs.map((doc) => doc.data()))) return false;
  if (await isImportBatchCanceled(db, ownerId, batchId)) return false;
  await enqueue({ kind: "finalize_plan", ownerId, batchId, resourceId: batchId });
  return true;
}

async function parsedItem(item: Row, sourcePath: string): Promise<PlanInventoryItem> {
  let bytes: Buffer;
  try { bytes = (await getStorage().bucket().file(sourcePath).download())[0]; }
  catch (error) {
    if (isMissingStorageObject(error)) throw new MissingSourceObjectError(String(item.itemId), typeof item.sourceId === "string" ? item.sourceId : undefined);
    throw error;
  }
  const metadata = await serverParseFontFile(bytes, String(item.filename));
  if (!metadata) throw new Error(`font_metadata_unreadable:${String(item.itemId)}`);
  return { ...item, ...metadata, itemId: String(item.itemId), ownerId: String(item.ownerId), batchId: String(item.batchId), sha256: String(item.sha256) };
}

class MissingSourceObjectError extends Error {
  constructor(readonly itemId: string, readonly sourceId?: string) { super("source_object_missing"); }
}

async function claimPlanAssets(db: Firestore, plan: ImportPlan): Promise<boolean> {
  for (const family of plan.families.filter((entry) => entry.clean)) for (const face of family.faces) for (const asset of face.assets) {
    if (await isImportBatchCanceled(db, plan.ownerId, plan.batchId)) return false;
    const result = await claimAsset(db, { ownerId: plan.ownerId, batchId: plan.batchId, itemId: asset.itemId,
      sha256: asset.sha256, familyId: family.familyId, logicalFaceKey: face.logicalFaceKey, assetId: asset.assetId });
    if (result.kind === "canceled") return false;
    if (result.kind === "busy") throw new Error(`asset_claim_busy:${asset.itemId}`);
  }
  return true;
}

export async function failPlanningTerminally(db: Firestore, payload: ImportTaskPayload, code: string, enqueue: Enqueue, missing: { itemId?: string; sourceId?: string } = {}): Promise<void> {
  const batch = importBatchRef(db, payload.ownerId, payload.batchId);
  const item = missing.itemId ? importItemRef(db, payload.ownerId, payload.batchId, missing.itemId) : undefined;
  const source = missing.sourceId ? importSourceRef(db, payload.ownerId, payload.batchId, missing.sourceId) : undefined;
  const pending: PendingImportDispatch = { token: `reconcile:${payload.batchId}`, task: { kind: "reconcile_batch", ownerId: payload.ownerId, batchId: payload.batchId, resourceId: payload.batchId } };
  const scheduled = await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(batch);
    if (!snapshot.exists || snapshot.data()?.outcome === "canceled") return false;
    const [itemSnapshot, sourceSnapshot] = await Promise.all([item ? tx.get(item) : Promise.resolve(undefined), source ? tx.get(source) : Promise.resolve(undefined)]);
    const data = snapshot.data() as Row; const phases = (data.phases as Row | undefined) ?? {}; const planning = (phases.planning as Row | undefined) ?? {};
    const error = { code, message: code, phase: "planning", retryable: false };
    if (item && itemSnapshot?.exists && !["applied", "duplicate", "review", "discarded", "failed"].includes(String(itemSnapshot.data()?.state))) tx.update(item, { state: "failed", error, updatedAt: new Date() });
    if (source && sourceSnapshot?.exists && !["failed", "canceled", "timed_out"].includes(String(sourceSnapshot.data()?.state))) tx.update(source, { state: "failed", error, updatedAt: new Date() });
    tx.update(batch, { phases: { ...phases, planning: { ...planning, state: "failed", error, updatedAt: new Date() } }, reconciliation: { state: "scheduled", requestedAt: new Date() }, pendingDispatch: pending, updatedAt: new Date() });
    return true;
  });
  if (!scheduled) return;
  try { await deliverPendingDispatch(db, batch, pending, enqueue); } catch { /* pendingDispatch remains for scheduled recovery */ }
}

/** Build the immutable plan from parsed font contents, lease its assets, then release apply tasks. */
export async function finalizePlanTask(payload: ImportTaskPayload, db: Firestore, dependencies: FinalizePlanDependencies = {}): Promise<{ status: 204 | 503 }> {
  if (payload.kind !== "finalize_plan") return { status: 204 };
  if (await isImportBatchCanceled(db, payload.ownerId, payload.batchId)) return { status: 204 };
  const batch = importBatchRef(db, payload.ownerId, payload.batchId);
  const [sourceSnap, itemSnap] = await Promise.all([batch.collection("sources").get(), batch.collection("items").get()]);
  const sources = new Map(sourceSnap.docs.map((doc) => [doc.id, doc.data() as Row]));
  const items = itemSnap.docs.map((doc) => doc.data() as Row);
  if (!isReady([...sources.values()], items)) return { status: 503 };
  let inputs: PlanInventoryItem[];
  try {
    inputs = await Promise.all(items.filter((item) => item.role === "font" && item.action === "apply").map(async (item) => {
      const source = sources.get(String(item.sourceId));
      const path = typeof item.stagingPath === "string" ? item.stagingPath : source?.storagePath;
      if (typeof path !== "string" || !path) throw new MissingSourceObjectError(String(item.itemId), typeof item.sourceId === "string" ? item.sourceId : undefined);
      return parsedItem(item, path);
    }));
  } catch (error) {
    if (!(error instanceof MissingSourceObjectError) && !isMissingStorageObject(error)) throw error;
    const missing = error instanceof MissingSourceObjectError ? { itemId: error.itemId, sourceId: error.sourceId } : {};
    await failPlanningTerminally(db, payload, "source_object_missing", dependencies.enqueueReconcile ?? enqueueImportTask, missing);
    return { status: 204 };
  }
  if (await isImportBatchCanceled(db, payload.ownerId, payload.batchId)) return { status: 204 };
  const saved = await saveValidatedPlan(db, buildImportPlan(inputs), { enqueue: async () => undefined, enqueueTasks: false });
  if (saved.kind === "batch_missing" || saved.kind === "canceled") return { status: 204 };
  if (!await claimPlanAssets(db, saved.plan)) return { status: 204 };
  if (await isImportBatchCanceled(db, payload.ownerId, payload.batchId)) return { status: 204 };
  await enqueuePendingPlanTasks(db, saved.plan);
  return { status: 204 };
}
