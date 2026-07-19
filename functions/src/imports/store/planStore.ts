import type { Firestore } from "firebase-admin/firestore";
import { enqueueImportTask, importTaskName, type ImportTaskPayload } from "../tasks/enqueue";
import { importBatchRef } from "./paths";
import { validatePlan } from "../planning/validatePlan";
import type { ImportPlan } from "../planning/buildPlan";
import { catalogFamilyDocId } from "../../storage/catalogIdentity";
import { FAMILIES_COLLECTION } from "../../storage/familyStore";

export interface PlanStoreDependencies {
  enqueue?: (payload: ImportTaskPayload) => Promise<unknown>;
  now?: () => Date;
  enqueueTasks?: boolean;
}
export type SavePlanResult =
  | { kind: "created"; planVersion: number; plan: ImportPlan }
  | { kind: "exists"; planVersion: number; plan: ImportPlan }
  | { kind: "batch_missing" };
const planRef = (db: Firestore, ownerId: string, batchId: string, version: number) =>
  importBatchRef(db, ownerId, batchId).collection("plans").doc(String(version));
const taskRef = (db: Firestore, ownerId: string, batchId: string, version: number, familyId: string) =>
  planRef(db, ownerId, batchId, version).collection("applyTasks").doc(familyId);
const errorText = (error: unknown): string => error instanceof Error ? error.message : String(error);
const payloadFor = (plan: ImportPlan, familyId: string): ImportTaskPayload => ({
  kind: "apply_family", ownerId: plan.ownerId, batchId: plan.batchId, resourceId: familyId, planVersion: plan.planVersion,
});
const familyVersion = (value: unknown): number => {
  const version = typeof value === "object" && value ? (value as { version?: unknown }).version : undefined;
  if (version === undefined) return 0;
  if (!Number.isSafeInteger(version) || (version as number) < 0) throw new Error("invalid catalogue family version");
  return version as number;
};

export async function enqueuePendingPlanTasks(
  db: Firestore, plan: ImportPlan, dependencies: PlanStoreDependencies = {},
): Promise<{ pending: number; enqueued: number }> {
  const enqueue = dependencies.enqueue ?? enqueueImportTask;
  let pending = 0; let enqueued = 0;
  for (const family of plan.families.filter((entry) => entry.clean)) {
    const ref = taskRef(db, plan.ownerId, plan.batchId, plan.planVersion, family.familyId);
    const snapshot = await ref.get(); if (!snapshot.exists) { pending++; continue; }
    const current = snapshot.data() as Record<string, any>; if (current.status === "enqueued") { enqueued++; continue; }
    const payload = current.payload as ImportTaskPayload ?? payloadFor(plan, family.familyId);
    const taskName = current.taskName ?? importTaskName(payload); const attempts = (current.attempts ?? 0) + 1;
    try {
      await enqueue(payload);
      await db.runTransaction(async (tx) => { const latest = await tx.get(ref); if (!latest.exists || latest.data()?.status === "enqueued") return; const at = (dependencies.now ?? (() => new Date()))(); tx.update(ref, { ...latest.data(), status: "enqueued", attempts, taskName, updatedAt: at, transitions: [...(latest.data()?.transitions ?? []), { status: "enqueued", at }] }); });
      enqueued++;
    } catch (error) {
      await db.runTransaction(async (tx) => { const latest = await tx.get(ref); if (!latest.exists || latest.data()?.status === "enqueued") return; const at = (dependencies.now ?? (() => new Date()))(); tx.update(ref, { ...latest.data(), status: "pending", attempts, taskName, lastError: errorText(error), updatedAt: at, transitions: [...(latest.data()?.transitions ?? []), { status: "failed", at, error: errorText(error) }] }); });
      pending++;
    }
  }
  return { pending, enqueued };
}

export async function saveValidatedPlan(
  db: Firestore, input: ImportPlan, dependencies: PlanStoreDependencies = {},
): Promise<SavePlanResult> {
  const validated = validatePlan(input);
  const result = await db.runTransaction(async (tx) => {
    const batchRef = importBatchRef(db, validated.ownerId, validated.batchId);
    const batchSnap = await tx.get(batchRef);
    if (!batchSnap.exists) return { kind: "batch_missing" } as const;
    const current = batchSnap.data() as { planVersion?: number };
    const planVersion = Math.max(0, current.planVersion ?? 0);
    const next = planVersion + 1;
    const plan = validatePlan({ ...validated, planVersion: next, contentHash: undefined });
    const existing = await tx.get(planRef(db, plan.ownerId, plan.batchId, next));
    const expectedFamilyVersions = Object.fromEntries(await Promise.all(plan.families.filter((family) => family.clean).map(async (family) => {
      const snapshot = await tx.get(db.collection(FAMILIES_COLLECTION).doc(catalogFamilyDocId(plan.ownerId, family.familySlug)));
      return [family.familyId, familyVersion(snapshot.exists ? snapshot.data() : undefined)];
    })));
    if (existing.exists) return { kind: "exists", planVersion: next, plan } as const;
    tx.set(planRef(db, plan.ownerId, plan.batchId, next), { ...plan, expectedFamilyVersions });
    for (const family of plan.families.filter((entry) => entry.clean)) {
      const payload: ImportTaskPayload = { kind: "apply_family", ownerId: plan.ownerId, batchId: plan.batchId, resourceId: family.familyId, planVersion: next };
      const at = new Date(); tx.set(taskRef(db, plan.ownerId, plan.batchId, next, family.familyId), { payload, taskName: importTaskName(payload), status: "pending", expectedFamilyVersion: expectedFamilyVersions[family.familyId], attempts: 0, transitions: [{ status: "pending", at }], planContentHash: plan.contentHash, createdAt: at, updatedAt: at });
    }
    tx.update(batchRef, { planVersion: next, phases: { ...(batchSnap.data() as any).phases, planning: { state: "validated", attempts: 0 } } });
    return { kind: "created", planVersion: next, plan } as const;
  });
  if (result.kind === "created" && dependencies.enqueueTasks !== false) await enqueuePendingPlanTasks(db, result.plan, dependencies);
  return result;
}

export const savePlan = saveValidatedPlan;
