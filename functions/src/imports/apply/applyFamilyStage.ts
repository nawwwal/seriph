import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { applyFamilyTask } from "./applyFamilyPlan";
import type { ImportStageHandler } from "../tasks/dispatch";
import { enqueueImportTask } from "../tasks/enqueue";

export const applyFamilyImportStage: ImportStageHandler = async (payload) => {
  const result = await applyFamilyTask(payload, {
    db: getFirestore(), sourceBucket: getStorage().bucket(),
  });
  if (result.kind === "applied" || result.kind === "already_applied") {
    await enqueueImportTask({ kind: "reconcile_batch", ownerId: payload.ownerId, batchId: payload.batchId, resourceId: payload.resourceId });
  }
  return result.kind === "failed" && result.retryable ? { status: 503, retryable: true } : { status: 204 };
};
