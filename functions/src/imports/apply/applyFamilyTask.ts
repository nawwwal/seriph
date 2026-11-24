import type { Firestore } from "firebase-admin/firestore";
import type { Bucket } from "@google-cloud/storage";
import type { ImportTaskPayload } from "../tasks/enqueue";
import type { ImportPlan } from "../planning/buildPlan";
import type { PlannedAssetClaim } from "./writePlannedAssets";
import { importBatchRef } from "../store/paths";
import { assetClaimRef, reuseCommittedAsset } from "../store/assetClaimStore";
import { recordFamilyPlanReview } from "./planApplicationState";
import { isImportBatchCanceled } from "../tasks/cancellation";
import { applyFamilyPlan, type ApplyFamilyResult, type EnrichmentJobRequest } from "./applyFamilyPlan";

export interface ApplyFamilyTaskDependencies {
  db: Firestore;
  sourceBucket: Pick<Bucket, "file">;
  enqueueEnrichment?: (request: EnrichmentJobRequest) => Promise<unknown>;
}

async function mapBounded<T, R>(items: readonly T[], limit: number, mapper: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await mapper(items[index]!, index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function reviewTask(db: Firestore, ownerId: string, batchId: string, planVersion: number, familyId: string, reasonCode: string): Promise<ApplyFamilyResult> {
  if (await isImportBatchCanceled(db, ownerId, batchId)) return { kind: "failed", retryable: false, errorCode: "batch_canceled" };
  try {
    await recordFamilyPlanReview({ db, ownerId, batchId, planVersion, familyId, reasonCode });
  } catch (error) {
    const code = error instanceof Error ? error.message.replace(/\s+/g, "_").toLowerCase() : "apply_failed";
    return { kind: "failed", retryable: true, errorCode: code };
  }
  return { kind: "review", reasonCode };
}

export async function applyFamilyTask(payload: ImportTaskPayload, deps: ApplyFamilyTaskDependencies): Promise<ApplyFamilyResult> {
  if (payload.kind !== "apply_family" || payload.planVersion === undefined) return { kind: "failed", retryable: false, errorCode: "plan_version_missing" };
  if (await isImportBatchCanceled(deps.db, payload.ownerId, payload.batchId)) return { kind: "failed", retryable: false, errorCode: "batch_canceled" };
  const batch = importBatchRef(deps.db, payload.ownerId, payload.batchId);
  const planSnap = await batch.collection("plans").doc(String(payload.planVersion)).get();
  if (!planSnap.exists) return { kind: "failed", retryable: true, errorCode: "plan_missing" };
  const stored = planSnap.data() as ImportPlan;
  const plan: ImportPlan = {
    ownerId: stored.ownerId, batchId: stored.batchId, planVersion: stored.planVersion, state: stored.state,
    items: stored.items, families: stored.families, reviewItems: stored.reviewItems, contentHash: stored.contentHash,
  };
  const family = plan.families.find((entry) => entry.familyId === payload.resourceId);
  if (!family) return reviewTask(deps.db, payload.ownerId, payload.batchId, payload.planVersion, payload.resourceId, "family_missing");
  const taskSnap = await batch.collection("plans").doc(String(payload.planVersion)).collection("applyTasks").doc(payload.resourceId).get();
  const expectedFamilyVersions = (planSnap.data() as { expectedFamilyVersions?: Record<string, unknown> }).expectedFamilyVersions;
  const planned = expectedFamilyVersions?.[payload.resourceId];
  const taskExpected = taskSnap.data()?.expectedFamilyVersion;
  if (!Number.isSafeInteger(planned) || (planned as number) < 0 || taskExpected !== planned) {
    return reviewTask(deps.db, payload.ownerId, payload.batchId, payload.planVersion, payload.resourceId, "expected_version_missing");
  }
  const plannedAssets = family.faces.flatMap((face) => face.assets.map((asset) => ({ asset, logicalFaceKey: face.logicalFaceKey })));
  const loaded = await mapBounded(plannedAssets, 4, async ({ asset, logicalFaceKey }) => {
    const [claimSnap, itemSnap] = await Promise.all([assetClaimRef(deps.db, payload.ownerId, asset.sha256).get(), batch.collection("items").doc(asset.itemId).get()]);
    const item = itemSnap.data();
    const source = item?.sourceId ? await batch.collection("sources").doc(String(item.sourceId)).get() : null;
    return { asset, logicalFaceKey, data: claimSnap.data() as Record<string, any> | undefined, item, sourcePath: item?.stagingPath ?? source?.data()?.storagePath };
  });
  const conflict = loaded.find((entry) => entry.data?.status === "committed" && (entry.data.familyId !== family.familyId || entry.data.logicalFaceKey !== entry.logicalFaceKey));
  if (conflict) return reviewTask(deps.db, payload.ownerId, payload.batchId, payload.planVersion, payload.resourceId, "asset_claim_identity_conflict");
  const claims: PlannedAssetClaim[] = [];
  for (const entry of loaded) {
    let data = entry.data;
    if (data?.status === "committed") {
      const reused = await reuseCommittedAsset(deps.db, { ownerId: payload.ownerId, batchId: payload.batchId, itemId: entry.asset.itemId,
        sha256: entry.asset.sha256, familyId: family.familyId, logicalFaceKey: entry.logicalFaceKey, assetId: String(data.assetId ?? "") });
      if (reused.kind === "conflict") return reviewTask(deps.db, payload.ownerId, payload.batchId, payload.planVersion, payload.resourceId, "asset_claim_identity_conflict");
      if (reused.kind === "canceled") return { kind: "failed", retryable: false, errorCode: "batch_canceled" };
      if (reused.kind === "busy") return { kind: "failed", retryable: true, errorCode: "asset_claim_busy" };
      if (reused.kind === "not_committed") return { kind: "failed", retryable: true, errorCode: "asset_claim_state_changed" };
      data = { ...data, ...entry.asset, assetId: reused.assetId, claimId: `${payload.batchId}:${entry.asset.itemId}`, status: "leased" };
    }
    claims.push({
      ...(data as PlannedAssetClaim),
      sourcePath: entry.sourcePath,
      originalName: data?.originalName ?? entry.item?.filename ?? entry.item?.originalName,
      sourceId: typeof entry.item?.sourceId === "string" ? entry.item.sourceId : undefined,
      fontMetadata: entry.item?.fontMetadata && typeof entry.item.fontMetadata === "object" ? entry.item.fontMetadata : undefined,
    });
  }
  if (await isImportBatchCanceled(deps.db, payload.ownerId, payload.batchId)) return { kind: "failed", retryable: false, errorCode: "batch_canceled" };
  return applyFamilyPlan({ plan, familyId: payload.resourceId, expectedVersion: planned as number, claims }, {
    db: deps.db, enqueueEnrichment: deps.enqueueEnrichment,
    isCanceled: () => isImportBatchCanceled(deps.db, payload.ownerId, payload.batchId),
    read: async (claim) => { if (!claim.sourcePath) throw new Error("staging path missing"); return (await deps.sourceBucket.file(claim.sourcePath).download())[0]; },
  });
}
