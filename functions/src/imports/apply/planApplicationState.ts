import type { Firestore } from "firebase-admin/firestore";
import { importBatchRef } from "../store/paths";

export async function recordFamilyPlanReview(input: {
  db: Firestore; ownerId: string; batchId: string; planVersion: number; familyId: string; reasonCode: string; now?: Date;
}): Promise<void> {
  const batch = importBatchRef(input.db, input.ownerId, input.batchId);
  const plan = batch.collection("plans").doc(String(input.planVersion));
  const task = plan.collection("applyTasks").doc(input.familyId);
  const at = input.now ?? new Date();
  await input.db.runTransaction(async (tx) => {
    const [planSnap, taskSnap] = await Promise.all([tx.get(plan), tx.get(task)]);
    const result = { kind: "review", reasonCode: input.reasonCode };
    tx.set(task, { ...(taskSnap.exists ? taskSnap.data() : {}), status: "review", result, updatedAt: at });
    tx.set(plan, { ...(planSnap.exists ? planSnap.data() : {}), state: "partial", application: { ...result, familyId: input.familyId, updatedAt: at }, updatedAt: at });
  });
}
