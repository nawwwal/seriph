import type { Firestore } from "firebase-admin/firestore";
import type { Bucket } from "@google-cloud/storage";
import type { ImportTaskPayload } from "../tasks/enqueue";
import { validatePlan } from "../planning/validatePlan";
import type { ImportPlan } from "../planning/buildPlan";
import { writePlannedAssets, type PlannedAssetClaim, type WritePlannedAssetsDependencies } from "./writePlannedAssets";
import { commitFamilyMutation, type MutationCommitResult } from "../store/mutationStore";
import { importBatchRef } from "../store/paths";
import { assetClaimRef, commitAssetClaim, reuseCommittedAsset } from "../store/assetClaimStore";
import { recordFamilyPlanAlreadyApplied, recordFamilyPlanReview } from "./planApplicationState";
import { currentEnrichmentVersions } from "../../ai/enrich/parse";
import { enrichmentJobId, type EnrichmentJobCommitInput } from "../../enrichment/jobs/jobStore";
import { isImportBatchCanceled } from "../tasks/cancellation";
import { FAMILIES_COLLECTION } from "../../storage/familyStore";
import { catalogFamilyDocId } from "../../storage/catalogIdentity";

export type ApplyFamilyResult =
  | { kind: "applied"; familyId: string; familyVersion: number; mutationId: string }
  | { kind: "already_applied"; familyId: string; familyVersion: number }
  | { kind: "replan_required"; expectedVersion: number; actualVersion: number }
  | { kind: "review"; reasonCode: string }
  | { kind: "failed"; retryable: boolean; errorCode: string };
export interface ApplyFamilyPlanInput { plan: ImportPlan; familyId: string; expectedVersion?: number; expectedFamilyVersion?: number; claims: readonly PlannedAssetClaim[]; mutationId?: string; }
export interface ApplyFamilyPlanDependencies extends WritePlannedAssetsDependencies {
  db: Firestore; now?: () => Date; enqueueEnrichment?: (request: EnrichmentJobRequest) => Promise<unknown>;
  commitFamilyMutation?: typeof commitFamilyMutation;
  commitAssetClaim?: typeof commitAssetClaim;
  isCanceled?: () => Promise<boolean>;
}
export interface EnrichmentJobRequest {
  jobId: string;
  ownerId: string;
  batchId: string;
  familyId: string;
  familyVersion: number;
  planVersion: number;
  promptVersion: string;
  analysisModel: string;
  embeddingVersion: string;
}
export interface ApplyFamilyTaskDependencies {
  db: Firestore; sourceBucket: Pick<Bucket, "file">; enqueueEnrichment?: (request: EnrichmentJobRequest) => Promise<unknown>;
}
const mutationIdFor = (input: ApplyFamilyPlanInput): string => input.mutationId ?? `${input.plan.ownerId}:${input.plan.batchId}:${input.plan.planVersion}:${input.familyId}`;
const errorCode = (error: unknown): string => error instanceof Error ? error.message.replace(/\s+/g, "_").toLowerCase() : "apply_failed";
const resultFor = (familyId: string, result: MutationCommitResult): ApplyFamilyResult => result.kind === "canceled"
  ? { kind: "failed", retryable: false, errorCode: "batch_canceled" } : result.kind === "committed"
  ? { kind: "applied", familyId, familyVersion: result.familyVersion, mutationId: result.mutationId }
  : result.kind === "already_applied" ? { kind: "already_applied", familyId, familyVersion: result.familyVersion } : result;
async function review(input: ApplyFamilyPlanInput, deps: ApplyFamilyPlanDependencies, reasonCode: string): Promise<ApplyFamilyResult> {
  if (await (deps.isCanceled ?? (() => isImportBatchCanceled(deps.db, input.plan.ownerId, input.plan.batchId)))()) return { kind: "failed", retryable: false, errorCode: "batch_canceled" };
  try { await recordFamilyPlanReview({ db: deps.db, ownerId: input.plan.ownerId, batchId: input.plan.batchId, planVersion: input.plan.planVersion, familyId: input.familyId, reasonCode }); }
  catch (error) { return { kind: "failed", retryable: true, errorCode: errorCode(error) }; }
  return { kind: "review", reasonCode };
}

function enrichmentJobFor(input: ApplyFamilyPlanInput): EnrichmentJobCommitInput {
  const versions = currentEnrichmentVersions();
  return {
    ownerId: input.plan.ownerId,
    batchId: input.plan.batchId,
    familyId: input.familyId,
    planVersion: input.plan.planVersion,
    promptVersion: versions.promptVersion,
    analysisModel: versions.analysisModel,
    embeddingVersion: versions.embedVersion,
  };
}

function enrichmentJobRequest(input: ApplyFamilyPlanInput, familyVersion: number): EnrichmentJobRequest {
  const job = enrichmentJobFor(input);
  return {
    ...job,
    familyVersion,
    jobId: enrichmentJobId({ ownerId: job.ownerId, familyId: job.familyId, familyVersion, promptVersion: job.promptVersion,
      analysisModel: job.analysisModel, embeddingVersion: job.embeddingVersion }),
  };
}

function familyAlreadyContains(input: {
  family: ImportPlan["families"][number]; existing: Record<string, any> | undefined; expectedVersion: number;
}): boolean {
  if (!input.existing || Number(input.existing.version ?? 0) !== input.expectedVersion) return false;
  const existingFaces = Array.isArray(input.existing.faces) ? input.existing.faces as Record<string, any>[] : [];
  return input.family.faces.every((face) => {
    const currentFace = existingFaces.find((entry) => entry.id === face.logicalFaceKey || entry.logicalFaceKey === face.logicalFaceKey);
    const existingAssets = Array.isArray(currentFace?.assets) ? currentFace.assets as Record<string, any>[] : [];
    return face.assets.every((asset) => existingAssets.some((entry) => entry.contentHash === asset.sha256));
  });
}

async function commitReusableClaims(input: ApplyFamilyPlanInput, deps: ApplyFamilyPlanDependencies): Promise<void> {
  const commit = deps.commitAssetClaim ?? commitAssetClaim;
  const unique = new Map(input.claims.map((claim) => [claim.sha256, claim]));
  await mapBounded([...unique.values()], 4, async (claim) => {
    const result = await commit(deps.db, claim, (deps.now ?? (() => new Date()))());
    if (result.kind === "not_claimed") throw new Error("asset claim is not leased");
  });
}

export async function applyFamilyPlan(input: ApplyFamilyPlanInput, deps: ApplyFamilyPlanDependencies): Promise<ApplyFamilyResult> {
  const canceled = deps.isCanceled ?? (() => isImportBatchCanceled(deps.db, input.plan.ownerId, input.plan.batchId));
  if (await canceled()) return { kind: "failed", retryable: false, errorCode: "batch_canceled" };
  let plan: ImportPlan;
  try { plan = validatePlan(input.plan); } catch { return review(input, deps, "invalid_plan"); }
  const family = plan.families.find((entry) => entry.familyId === input.familyId);
  if (!family) return review(input, deps, "family_missing");
  if (!family.clean) return review(input, deps, "family_requires_review");
  const expectedVersion = input.expectedVersion ?? input.expectedFamilyVersion;
  if (!Number.isSafeInteger(expectedVersion) || (expectedVersion as number) < 0) return review(input, deps, "expected_version_missing");
  const assets = family.faces.flatMap((face) => face.assets);
  const familySnapshot = await deps.db.collection(FAMILIES_COLLECTION).doc(catalogFamilyDocId(plan.ownerId, family.familySlug)).get();
  if (familyAlreadyContains({ family, existing: familySnapshot.exists ? familySnapshot.data() : undefined, expectedVersion: expectedVersion as number })) {
    try {
      await commitReusableClaims(input, deps);
      await recordFamilyPlanAlreadyApplied({ db: deps.db, ownerId: plan.ownerId, batchId: plan.batchId, planVersion: plan.planVersion,
        familyId: input.familyId, familyVersion: expectedVersion as number, cleanFamilyIds: plan.families.filter((entry) => entry.clean).map((entry) => entry.familyId), now: (deps.now ?? (() => new Date()))() });
      return { kind: "already_applied", familyId: input.familyId, familyVersion: expectedVersion as number };
    } catch (error) {
      const code = errorCode(error);
      return { kind: "failed", retryable: code !== "batch_canceled", errorCode: code };
    }
  }
  const mutationId = mutationIdFor(input);
  try {
    const written = await writePlannedAssets({ ownerId: plan.ownerId, familyId: input.familyId, familySlug: family.familySlug, assets, claims: input.claims }, { ...deps, isCanceled: canceled });
    if (await canceled()) return { kind: "failed", retryable: false, errorCode: "batch_canceled" };
    const commit = await (deps.commitFamilyMutation ?? commitFamilyMutation)({ db: deps.db, plan, familyId: input.familyId, expectedVersion: expectedVersion as number, mutationId, assets: written, claims: written.map((asset) => asset.source), now: (deps.now ?? (() => new Date()))(), enrichmentJob: enrichmentJobFor(input) });
    const result = resultFor(input.familyId, commit);
    if (result.kind === "applied" || result.kind === "already_applied") {
      if (deps.enqueueEnrichment) await deps.enqueueEnrichment(enrichmentJobRequest(input, result.familyVersion));
    }
    return result;
  } catch (error) { const code = errorCode(error); return { kind: "failed", retryable: code !== "batch_canceled", errorCode: code }; }
}

export async function applyFamilyTask(payload: ImportTaskPayload, deps: ApplyFamilyTaskDependencies): Promise<ApplyFamilyResult> {
  if (payload.kind !== "apply_family" || payload.planVersion === undefined) return { kind: "failed", retryable: false, errorCode: "plan_version_missing" };
  if (await isImportBatchCanceled(deps.db, payload.ownerId, payload.batchId)) return { kind: "failed", retryable: false, errorCode: "batch_canceled" };
  const batch = importBatchRef(deps.db, payload.ownerId, payload.batchId);
  const planSnap = await batch.collection("plans").doc(String(payload.planVersion)).get();
  if (!planSnap.exists) return { kind: "failed", retryable: true, errorCode: "plan_missing" };
  const stored = planSnap.data() as ImportPlan;
  // The plan document carries operational fields such as expectedFamilyVersions.
  // They are not part of its content-addressed payload.
  const plan: ImportPlan = {
    ownerId: stored.ownerId, batchId: stored.batchId, planVersion: stored.planVersion, state: stored.state,
    items: stored.items, families: stored.families, reviewItems: stored.reviewItems, contentHash: stored.contentHash,
  };
  const family = plan.families.find((entry) => entry.familyId === payload.resourceId);
  if (!family) return review({ plan, familyId: payload.resourceId, claims: [] }, { db: deps.db, isCanceled: () => isImportBatchCanceled(deps.db, payload.ownerId, payload.batchId) }, "family_missing");
  const taskSnap = await batch.collection("plans").doc(String(payload.planVersion)).collection("applyTasks").doc(payload.resourceId).get();
  const expectedFamilyVersions = (planSnap.data() as { expectedFamilyVersions?: Record<string, unknown> }).expectedFamilyVersions;
  const planned = expectedFamilyVersions?.[payload.resourceId]; const taskExpected = taskSnap.data()?.expectedFamilyVersion;
  if (!Number.isSafeInteger(planned) || (planned as number) < 0 || taskExpected !== planned) return review({ plan, familyId: payload.resourceId, claims: [] }, { db: deps.db, isCanceled: () => isImportBatchCanceled(deps.db, payload.ownerId, payload.batchId) }, "expected_version_missing");
  const plannedAssets = family.faces.flatMap((face) => face.assets.map((asset) => ({ asset, logicalFaceKey: face.logicalFaceKey })));
  const loaded = await mapBounded(plannedAssets, 4, async ({ asset, logicalFaceKey }) => {
    const [claimSnap, itemSnap] = await Promise.all([assetClaimRef(deps.db, payload.ownerId, asset.sha256).get(), batch.collection("items").doc(asset.itemId).get()]);
    const item = itemSnap.data(); const source = item?.sourceId ? await batch.collection("sources").doc(String(item.sourceId)).get() : null;
    return { asset, logicalFaceKey, data: claimSnap.data() as Record<string, any> | undefined, item, sourcePath: item?.stagingPath ?? source?.data()?.storagePath };
  });
  const conflict = loaded.find((entry) => entry.data?.status === "committed" && (entry.data.familyId !== family.familyId || entry.data.logicalFaceKey !== entry.logicalFaceKey));
  if (conflict) return review({ plan, familyId: payload.resourceId, claims: [] }, { db: deps.db, isCanceled: () => isImportBatchCanceled(deps.db, payload.ownerId, payload.batchId) }, "asset_claim_identity_conflict");
  const claims: PlannedAssetClaim[] = [];
  for (const entry of loaded) {
    let data = entry.data;
    if (data?.status === "committed") {
      const reused = await reuseCommittedAsset(deps.db, { ownerId: payload.ownerId, batchId: payload.batchId, itemId: entry.asset.itemId,
        sha256: entry.asset.sha256, familyId: family.familyId, logicalFaceKey: entry.logicalFaceKey, assetId: String(data.assetId ?? "") });
      if (reused.kind === "conflict") return review({ plan, familyId: payload.resourceId, claims: [] }, { db: deps.db, isCanceled: () => isImportBatchCanceled(deps.db, payload.ownerId, payload.batchId) }, "asset_claim_identity_conflict");
      if (reused.kind === "canceled") return { kind: "failed", retryable: false, errorCode: "batch_canceled" };
      if (reused.kind === "busy") return { kind: "failed", retryable: true, errorCode: "asset_claim_busy" };
      if (reused.kind === "not_committed") return { kind: "failed", retryable: true, errorCode: "asset_claim_state_changed" };
      data = { ...data, ...entry.asset, assetId: reused.assetId, claimId: `${payload.batchId}:${entry.asset.itemId}`, status: "leased" };
    }
    claims.push({ ...(data as PlannedAssetClaim), sourcePath: entry.sourcePath, originalName: data?.originalName ?? entry.item?.filename ?? entry.item?.originalName });
  }
  if (await isImportBatchCanceled(deps.db, payload.ownerId, payload.batchId)) return { kind: "failed", retryable: false, errorCode: "batch_canceled" };
  return applyFamilyPlan({ plan, familyId: payload.resourceId, expectedVersion: planned as number, claims }, { db: deps.db, enqueueEnrichment: deps.enqueueEnrichment,
    isCanceled: () => isImportBatchCanceled(deps.db, payload.ownerId, payload.batchId),
    read: async (claim) => { if (!claim.sourcePath) throw new Error("staging path missing"); return (await deps.sourceBucket.file(claim.sourcePath).download())[0]; } });
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
