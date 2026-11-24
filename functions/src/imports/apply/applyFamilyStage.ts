import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { applyFamilyTask } from "./applyFamilyPlan";
import { importBatchRef } from "../store/paths";
import type { ImportStageHandler } from "../tasks/dispatch";
import { enqueueImportTask } from "../tasks/enqueue";

const MAX_APPLY_ATTEMPTS = 3;

export const applyFamilyImportStage: ImportStageHandler = async (payload) => {
  const db = getFirestore();
  const result = await applyFamilyTask(payload, { db, sourceBucket: getStorage().bucket() });
  const taskRef = payload.planVersion !== undefined
    ? importBatchRef(db, payload.ownerId, payload.batchId)
      .collection("plans").doc(String(payload.planVersion)).collection("applyTasks").doc(payload.resourceId)
    : null;

  if (result.kind === "failed" && result.retryable && taskRef) {
    const snap = await taskRef.get();
    const attempts = Number(snap.data()?.attempts ?? 0) + 1;
    const exhausted = attempts >= MAX_APPLY_ATTEMPTS;
    await taskRef.set({
      status: exhausted ? "failed" : "retrying",
      attempts,
      maxAttempts: MAX_APPLY_ATTEMPTS,
      retryable: true,
      lastError: result.errorCode,
      updatedAt: new Date(),
    }, { merge: true });
    if (!exhausted) return { status: 503, retryable: true };
  } else if (result.kind === "failed" && taskRef) {
    await taskRef.set({ status: "failed", retryable: false, maxAttempts: MAX_APPLY_ATTEMPTS, lastError: result.errorCode, updatedAt: new Date() }, { merge: true });
  } else if (result.kind === "replan_required" && taskRef) {
    await taskRef.set({ status: "replan_required", retryable: true, maxAttempts: MAX_APPLY_ATTEMPTS, lastError: "version_conflict", error: { code: "version_conflict", retryable: true }, updatedAt: new Date() }, { merge: true });
  }
  await enqueueImportTask({ kind: "reconcile_batch", ownerId: payload.ownerId, batchId: payload.batchId, resourceId: payload.resourceId, observedAtMs: Date.now() });
  return { status: 204 };
};
