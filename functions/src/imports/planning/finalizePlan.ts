import type { Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { serverParseFontFile } from "../../parser/fontParser";
import { claimAsset } from "../store/assetClaimStore";
import { enqueuePendingPlanTasks, saveValidatedPlan } from "../store/planStore";
import { importBatchRef } from "../store/paths";
import type { ImportTaskPayload } from "../tasks/enqueue";
import { buildImportPlan, type ImportPlan, type PlanInventoryItem } from "./buildPlan";

type Row = Record<string, unknown>;
type Enqueue = (payload: ImportTaskPayload) => Promise<unknown>;
const terminalSource = new Set(["discovered", "failed", "canceled", "timed_out"]);
const terminalItem = new Set(["classified", "applied", "duplicate", "review", "discarded", "failed"]);

function isReady(sources: readonly Row[], items: readonly Row[]): boolean {
  return sources.length > 0 && sources.every((source) => terminalSource.has(String(source.state)))
    && items.length > 0 && items.every((item) => terminalItem.has(String(item.state)));
}

/** Queue planning only after every source and inventory item has a durable terminal state. */
export async function requestPlanFinalization(db: Firestore, ownerId: string, batchId: string, enqueue: Enqueue): Promise<boolean> {
  const batch = importBatchRef(db, ownerId, batchId);
  const [sources, items] = await Promise.all([batch.collection("sources").get(), batch.collection("items").get()]);
  if (!isReady(sources.docs.map((doc) => doc.data()), items.docs.map((doc) => doc.data()))) return false;
  await enqueue({ kind: "finalize_plan", ownerId, batchId, resourceId: batchId });
  return true;
}

async function parsedItem(item: Row, sourcePath: string): Promise<PlanInventoryItem> {
  const bytes = (await getStorage().bucket().file(sourcePath).download())[0];
  const metadata = await serverParseFontFile(bytes, String(item.filename));
  if (!metadata) throw new Error(`font_metadata_unreadable:${String(item.itemId)}`);
  return { ...item, ...metadata, itemId: String(item.itemId), ownerId: String(item.ownerId), batchId: String(item.batchId), sha256: String(item.sha256) };
}

async function claimPlanAssets(db: Firestore, plan: ImportPlan): Promise<void> {
  for (const family of plan.families.filter((entry) => entry.clean)) for (const face of family.faces) for (const asset of face.assets) {
    const result = await claimAsset(db, { ownerId: plan.ownerId, batchId: plan.batchId, itemId: asset.itemId,
      sha256: asset.sha256, familyId: family.familyId, logicalFaceKey: face.logicalFaceKey, assetId: asset.assetId });
    if (result.kind === "busy") throw new Error(`asset_claim_busy:${asset.itemId}`);
  }
}

/** Build the immutable plan from parsed font contents, lease its assets, then release apply tasks. */
export async function finalizePlanTask(payload: ImportTaskPayload, db: Firestore): Promise<{ status: 204 | 503 }> {
  if (payload.kind !== "finalize_plan") return { status: 204 };
  const batch = importBatchRef(db, payload.ownerId, payload.batchId);
  const [sourceSnap, itemSnap] = await Promise.all([batch.collection("sources").get(), batch.collection("items").get()]);
  const sources = new Map(sourceSnap.docs.map((doc) => [doc.id, doc.data() as Row]));
  const items = itemSnap.docs.map((doc) => doc.data() as Row);
  if (!isReady([...sources.values()], items)) return { status: 503 };
  const inputs = await Promise.all(items.filter((item) => item.role === "font" && item.action === "apply").map(async (item) => {
    const source = sources.get(String(item.sourceId));
    const path = typeof item.stagingPath === "string" ? item.stagingPath : source?.storagePath;
    if (typeof path !== "string" || !path) throw new Error(`source_path_missing:${String(item.itemId)}`);
    return parsedItem(item, path);
  }));
  const saved = await saveValidatedPlan(db, buildImportPlan(inputs), { enqueue: async () => undefined, enqueueTasks: false });
  if (saved.kind === "batch_missing") return { status: 204 };
  await claimPlanAssets(db, saved.plan);
  await enqueuePendingPlanTasks(db, saved.plan);
  return { status: 204 };
}
