import type { Firestore } from "firebase-admin/firestore";
import type { Bucket } from "@google-cloud/storage";
import type { ImportTaskPayload } from "../tasks/enqueue";
import { validatePlan } from "../planning/validatePlan";
import type { ImportPlan } from "../planning/buildPlan";
import { writePlannedAssets, type PlannedAssetClaim, type WritePlannedAssetsDependencies } from "./writePlannedAssets";
import { commitFamilyMutation, type MutationCommitResult } from "../store/mutationStore";
import { importBatchRef } from "../store/paths";
import { assetClaimRef } from "../store/assetClaimStore";
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
}
export interface EnrichmentJobRequest { jobId: string; ownerId: string; batchId: string; familyId: string; familyVersion: number; planVersion: number; }
export interface ApplyFamilyTaskDependencies { db: Firestore; bucket: Pick<Bucket, "file">; }
const mutationIdFor = (input: ApplyFamilyPlanInput): string => input.mutationId ?? `${input.plan.ownerId}:${input.plan.batchId}:${input.plan.planVersion}:${input.familyId}`;
const errorCode = (error: unknown): string => error instanceof Error ? error.message.replace(/\s+/g, "_").toLowerCase() : "apply_failed";
const resultFor = (familyId: string, result: MutationCommitResult): ApplyFamilyResult => result.kind === "committed"
  ? { kind: "applied", familyId, familyVersion: result.familyVersion, mutationId: result.mutationId }
  : result.kind === "already_applied" ? { kind: "already_applied", familyId, familyVersion: result.familyVersion } : result;

export async function applyFamilyPlan(input: ApplyFamilyPlanInput, deps: ApplyFamilyPlanDependencies): Promise<ApplyFamilyResult> {
  let plan: ImportPlan;
  try { plan = validatePlan(input.plan); } catch { return { kind: "review", reasonCode: "invalid_plan" }; }
  const family = plan.families.find((entry) => entry.familyId === input.familyId);
  if (!family) return { kind: "review", reasonCode: "family_missing" };
  if (!family.clean) return { kind: "review", reasonCode: "family_requires_review" };
  const expectedVersion = input.expectedVersion ?? input.expectedFamilyVersion;
  if (!Number.isSafeInteger(expectedVersion) || (expectedVersion as number) < 0) return { kind: "review", reasonCode: "expected_version_missing" };
  const assets = family.faces.flatMap((face) => face.assets);
  const mutationId = mutationIdFor(input);
  try {
    const written = await writePlannedAssets({ ownerId: plan.ownerId, familyId: input.familyId, assets, claims: input.claims }, deps);
    const job: EnrichmentJobRequest = { jobId: `${mutationId}:enrichment`, ownerId: plan.ownerId, batchId: plan.batchId, familyId: input.familyId, familyVersion: (expectedVersion as number) + 1, planVersion: plan.planVersion };
    const commit = await (deps.commitFamilyMutation ?? commitFamilyMutation)({ db: deps.db, plan, familyId: input.familyId, expectedVersion: expectedVersion as number, mutationId, assets: written, claims: written.map((asset) => asset.source), now: (deps.now ?? (() => new Date()))(), enrichmentJobId: job.jobId });
    const result = resultFor(input.familyId, commit);
    if (result.kind === "applied" && deps.enqueueEnrichment) await deps.enqueueEnrichment(job);
    return result;
  } catch (error) { return { kind: "failed", retryable: true, errorCode: errorCode(error) }; }
}

export async function applyFamilyTask(payload: ImportTaskPayload, deps: ApplyFamilyTaskDependencies): Promise<ApplyFamilyResult> {
  if (payload.kind !== "apply_family" || payload.planVersion === undefined) return { kind: "failed", retryable: false, errorCode: "plan_version_missing" };
  const batch = importBatchRef(deps.db, payload.ownerId, payload.batchId);
  const planSnap = await batch.collection("plans").doc(String(payload.planVersion)).get();
  if (!planSnap.exists) return { kind: "failed", retryable: true, errorCode: "plan_missing" };
  const plan = planSnap.data() as ImportPlan;
  const family = plan.families.find((entry) => entry.familyId === payload.resourceId);
  if (!family) return { kind: "review", reasonCode: "family_missing" };
  const familyRef = deps.db.collection("fontfamilies").doc(catalogFamilyDocId(payload.ownerId, family.familySlug));
  const [familySnap, taskSnap] = await Promise.all([familyRef.get(), batch.collection("plans").doc(String(payload.planVersion)).collection("applyTasks").doc(payload.resourceId).get()]);
  const claims = await Promise.all(family.faces.flatMap((face) => face.assets).map(async (asset) => {
    const [claimSnap, itemSnap] = await Promise.all([assetClaimRef(deps.db, payload.ownerId, asset.sha256).get(), batch.collection("items").doc(asset.itemId).get()]);
    return { ...(claimSnap.data() as PlannedAssetClaim), sourcePath: itemSnap.data()?.stagingPath };
  }));
  const expectedVersion = Number(taskSnap.data()?.expectedFamilyVersion ?? familySnap.data()?.version ?? 0);
  return applyFamilyPlan({ plan, familyId: payload.resourceId, expectedVersion, claims }, { db: deps.db, bucket: deps.bucket,
    read: async (claim) => { if (!claim.sourcePath) throw new Error("staging path missing"); return (await deps.bucket.file(claim.sourcePath).download())[0]; } });
}
