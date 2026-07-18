import type { Firestore } from "firebase-admin/firestore";
import { enqueueImportTask, type ImportTaskPayload } from "../tasks/enqueue";
import { importBatchRef } from "./paths";
import { validatePlan } from "../planning/validatePlan";
import type { ImportPlan } from "../planning/buildPlan";

export interface PlanStoreDependencies {
  enqueue?: (payload: ImportTaskPayload) => Promise<unknown>;
}
export type SavePlanResult =
  | { kind: "created"; planVersion: number; plan: ImportPlan }
  | { kind: "exists"; planVersion: number; plan: ImportPlan }
  | { kind: "batch_missing" };
const planRef = (db: Firestore, ownerId: string, batchId: string, version: number) =>
  importBatchRef(db, ownerId, batchId).collection("plans").doc(String(version));
const taskRef = (db: Firestore, ownerId: string, batchId: string, version: number, familyId: string) =>
  planRef(db, ownerId, batchId, version).collection("applyTasks").doc(familyId);

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
    if (existing.exists) return { kind: "exists", planVersion: next, plan } as const;
    tx.set(planRef(db, plan.ownerId, plan.batchId, next), plan);
    for (const family of plan.families.filter((entry) => entry.clean)) {
      const payload: ImportTaskPayload = { kind: "apply_family", ownerId: plan.ownerId, batchId: plan.batchId, resourceId: family.familyId, planVersion: next };
      tx.set(taskRef(db, plan.ownerId, plan.batchId, next, family.familyId), { payload, state: "pending", planContentHash: plan.contentHash });
    }
    tx.update(batchRef, { planVersion: next, phases: { ...(batchSnap.data() as any).phases, planning: { state: "validated", attempts: 0 } } });
    return { kind: "created", planVersion: next, plan } as const;
  });
  if (result.kind === "created") {
    const enqueue = dependencies.enqueue ?? enqueueImportTask;
    await Promise.all(result.plan.families.filter((family) => family.clean).map((family) => enqueue({ kind: "apply_family", ownerId: result.plan.ownerId, batchId: result.plan.batchId, resourceId: family.familyId, planVersion: result.planVersion })));
  }
  return result;
}

export const savePlan = saveValidatedPlan;
