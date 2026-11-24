import type { Firestore } from "firebase-admin/firestore";
import { claimAsset } from "../store/assetClaimStore";
import { enqueuePendingPlanTasks, saveValidatedPlan } from "../store/planStore";
import { importBatchRef } from "../store/paths";
import { importItemRef } from "../store/itemStore";
import { readImportReadiness, terminalItemState, terminalSourceState } from "../store/batchStore";
import { enqueueImportTask, type ImportTaskPayload } from "../tasks/enqueue";
import { isImportBatchCanceled, isMissingStorageObject } from "../tasks/cancellation";
import { deliverPendingDispatch, pendingDispatch, type PendingImportDispatch } from "../reconcile/pendingDispatch";
import { buildImportPlan, type ImportPlan, type PlanInventoryItem } from "./buildPlan";
import { mapWithConcurrency } from "./limitedMap";
import { ensureImportReadiness } from "./readiness";
import { discoveredItem, failPlanningTerminally, MissingSourceObjectError, parsedItem } from "./planFailure";

export { failPlanningTerminally };

type Row = Record<string, unknown>;
type Enqueue = (payload: ImportTaskPayload) => Promise<unknown>;
export interface FinalizePlanDependencies { enqueueReconcile?: Enqueue; }

function isReady(sources: readonly Row[], items: readonly Row[]): boolean {
  return sources.length > 0 && sources.every((source) => terminalSourceState(source.state))
    && items.length > 0 && items.every((item) => terminalItemState(item.state));
}

/** Queue planning once, after durable counters prove every source and item is terminal. */
export async function requestPlanFinalization(db: Firestore, ownerId: string, batchId: string, enqueue: Enqueue): Promise<boolean> {
  const batch = importBatchRef(db, ownerId, batchId);
  if (await isImportBatchCanceled(db, ownerId, batchId)) return false;
  await ensureImportReadiness(db, batch);
  const task: ImportTaskPayload = { kind: "finalize_plan", ownerId, batchId, resourceId: batchId };
  const pending: PendingImportDispatch = { token: `finalize:${batchId}`, task };
  const scheduled = await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(batch);
    if (!snapshot.exists || snapshot.data()?.outcome === "canceled") return false;
    const data = snapshot.data() as Row; const readiness = readImportReadiness(data.readiness);
    const counters = (data.counters as Row | undefined) ?? {};
    if (!readiness || readiness.finalizationRequested || readiness.pendingSources > 0 || readiness.pendingItems > 0
      || Number(counters.sources ?? 0) < 1 || Number(counters.discoveredItems ?? 0) < 1) return false;
    const existing = pendingDispatch(data.pendingDispatch);
    if (existing && (existing.token !== pending.token || JSON.stringify(existing.task) !== JSON.stringify(task))) return false;
    tx.update(batch, { readiness: { ...readiness, finalizationRequested: true }, pendingDispatch: pending, updatedAt: new Date() });
    return true;
  });
  if (!scheduled) return false;
  try { await deliverPendingDispatch(db, batch, pending, enqueue); } catch { /* pendingDispatch remains for scheduled recovery */ }
  return true;
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
  const unparseableIds: string[] = [];
  try {
    const fontItems = items.filter((item) => item.role === "font" && item.action === "apply");
    const discovered = fontItems.filter((item) => item.fontMetadata && typeof item.fontMetadata === "object").map(discoveredItem);
    const legacy = fontItems.filter((item) => !item.fontMetadata || typeof item.fontMetadata !== "object");
    const parsedLegacy = await mapWithConcurrency(legacy, 4, async (item) => {
      if (item.fontMetadata && typeof item.fontMetadata === "object") return discoveredItem(item);
      const source = sources.get(String(item.sourceId));
      const path = typeof item.stagingPath === "string" ? item.stagingPath : source?.storagePath;
      if (typeof path !== "string" || !path) throw new MissingSourceObjectError(String(item.itemId), typeof item.sourceId === "string" ? item.sourceId : undefined);
      const parsed = await parsedItem(item, path);
      if (!parsed) unparseableIds.push(String(item.itemId));
      return parsed;
    });
    inputs = [...discovered, ...parsedLegacy.filter((entry): entry is PlanInventoryItem => entry !== null)];
  } catch (error) {
    if (!(error instanceof MissingSourceObjectError) && !isMissingStorageObject(error)) throw error;
    const missing = error instanceof MissingSourceObjectError ? { itemId: error.itemId, sourceId: error.sourceId } : {};
    await failPlanningTerminally(db, payload, "source_object_missing", dependencies.enqueueReconcile ?? enqueueImportTask, missing);
    return { status: 204 };
  }
  if (unparseableIds.length) {
    await Promise.all(unparseableIds.map((id) => importItemRef(db, payload.ownerId, payload.batchId, id).set({ state: "review", action: "review", reasonCode: "unparseable_font", updatedAt: new Date() }, { merge: true })));
  }
  if (await isImportBatchCanceled(db, payload.ownerId, payload.batchId)) return { status: 204 };
  const built = buildImportPlan(inputs, 1, { ownerId: payload.ownerId, batchId: payload.batchId });
  const saved = await saveValidatedPlan(db, built, { enqueue: async () => undefined, enqueueTasks: false });
  if (saved.kind === "batch_missing" || saved.kind === "canceled") return { status: 204 };
  if (saved.plan.families.filter((entry) => entry.clean).length === 0) {
    await batch.collection("plans").doc(String(saved.planVersion)).set({ state: saved.plan.reviewItems.length || unparseableIds.length ? "partial" : "applied", updatedAt: new Date() }, { merge: true });
    await (dependencies.enqueueReconcile ?? enqueueImportTask)({ kind: "reconcile_batch", ownerId: payload.ownerId, batchId: payload.batchId, resourceId: payload.batchId, observedAtMs: Date.now() });
    return { status: 204 };
  }
  if (!await claimPlanAssets(db, saved.plan)) return { status: 204 };
  if (await isImportBatchCanceled(db, payload.ownerId, payload.batchId)) return { status: 204 };
  await enqueuePendingPlanTasks(db, saved.plan);
  return { status: 204 };
}
