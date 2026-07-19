import type { Firestore } from "firebase-admin/firestore";
import type { Bucket } from "@google-cloud/storage";
import type { ImportTaskPayload } from "../tasks/enqueue";
import { validatePlan } from "../planning/validatePlan";
import type { ImportPlan } from "../planning/buildPlan";
import { writePlannedAssets, type PlannedAssetClaim, type WritePlannedAssetsDependencies } from "./writePlannedAssets";
import { commitFamilyMutation, type MutationCommitResult } from "../store/mutationStore";
import { importBatchRef } from "../store/paths";
import { assetClaimRef } from "../store/assetClaimStore";
import { recordFamilyPlanReview } from "./planApplicationState";
import { currentEnrichmentVersions } from "../../ai/enrich/parse";
import { enrichmentJobId, type EnrichmentJobCommitInput } from "../../enrichment/jobs/jobStore";

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
const resultFor = (familyId: string, result: MutationCommitResult): ApplyFamilyResult => result.kind === "committed"
  ? { kind: "applied", familyId, familyVersion: result.familyVersion, mutationId: result.mutationId }
  : result.kind === "already_applied" ? { kind: "already_applied", familyId, familyVersion: result.familyVersion } : result;
async function review(input: ApplyFamilyPlanInput, deps: ApplyFamilyPlanDependencies, reasonCode: string): Promise<ApplyFamilyResult> {
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
    jobId: enrichmentJobId({ familyId: job.familyId, familyVersion, promptVersion: job.promptVersion,
      analysisModel: job.analysisModel, embeddingVersion: job.embeddingVersion }),
  };
}

export async function applyFamilyPlan(input: ApplyFamilyPlanInput, deps: ApplyFamilyPlanDependencies): Promise<ApplyFamilyResult> {
  let plan: ImportPlan;
  try { plan = validatePlan(input.plan); } catch { return review(input, deps, "invalid_plan"); }
  const family = plan.families.find((entry) => entry.familyId === input.familyId);
  if (!family) return review(input, deps, "family_missing");
  if (!family.clean) return review(input, deps, "family_requires_review");
  const expectedVersion = input.expectedVersion ?? input.expectedFamilyVersion;
  if (!Number.isSafeInteger(expectedVersion) || (expectedVersion as number) < 0) return review(input, deps, "expected_version_missing");
  const assets = family.faces.flatMap((face) => face.assets);
  const mutationId = mutationIdFor(input);
  try {
    const written = await writePlannedAssets({ ownerId: plan.ownerId, familyId: input.familyId, familySlug: family.familySlug, assets, claims: input.claims }, deps);
    const commit = await (deps.commitFamilyMutation ?? commitFamilyMutation)({ db: deps.db, plan, familyId: input.familyId, expectedVersion: expectedVersion as number, mutationId, assets: written, claims: written.map((asset) => asset.source), now: (deps.now ?? (() => new Date()))(), enrichmentJob: enrichmentJobFor(input) });
    const result = resultFor(input.familyId, commit);
    if (result.kind === "applied" || result.kind === "already_applied") {
      if (deps.enqueueEnrichment) await deps.enqueueEnrichment(enrichmentJobRequest(input, result.familyVersion));
    }
    return result;
  } catch (error) { return { kind: "failed", retryable: true, errorCode: errorCode(error) }; }
}

export async function applyFamilyTask(payload: ImportTaskPayload, deps: ApplyFamilyTaskDependencies): Promise<ApplyFamilyResult> {
  if (payload.kind !== "apply_family" || payload.planVersion === undefined) return { kind: "failed", retryable: false, errorCode: "plan_version_missing" };
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
  if (!family) return review({ plan, familyId: payload.resourceId, claims: [] }, { db: deps.db }, "family_missing");
  const taskSnap = await batch.collection("plans").doc(String(payload.planVersion)).collection("applyTasks").doc(payload.resourceId).get();
  const expectedFamilyVersions = (planSnap.data() as { expectedFamilyVersions?: Record<string, unknown> }).expectedFamilyVersions;
  const planned = expectedFamilyVersions?.[payload.resourceId]; const taskExpected = taskSnap.data()?.expectedFamilyVersion;
  if (!Number.isSafeInteger(planned) || (planned as number) < 0 || taskExpected !== planned) return review({ plan, familyId: payload.resourceId, claims: [] }, { db: deps.db }, "expected_version_missing");
  const claims = await Promise.all(family.faces.flatMap((face) => face.assets).map(async (asset) => {
    const [claimSnap, itemSnap] = await Promise.all([assetClaimRef(deps.db, payload.ownerId, asset.sha256).get(), batch.collection("items").doc(asset.itemId).get()]);
    const item = itemSnap.data(); const source = item?.sourceId ? await batch.collection("sources").doc(String(item.sourceId)).get() : null;
    return { ...(claimSnap.data() as PlannedAssetClaim), sourcePath: item?.stagingPath ?? source?.data()?.storagePath };
  }));
  return applyFamilyPlan({ plan, familyId: payload.resourceId, expectedVersion: planned as number, claims }, { db: deps.db, enqueueEnrichment: deps.enqueueEnrichment,
    read: async (claim) => { if (!claim.sourcePath) throw new Error("staging path missing"); return (await deps.sourceBucket.file(claim.sourcePath).download())[0]; } });
}
