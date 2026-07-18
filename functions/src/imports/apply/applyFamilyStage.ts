import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { submitPendingEnrichmentBatch } from "../../ingest/batchEnrich";
import { applyFamilyTask } from "./applyFamilyPlan";
import type { ImportStageHandler } from "../tasks/dispatch";

export const applyFamilyImportStage: ImportStageHandler = async (payload) => {
  const result = await applyFamilyTask(payload, {
    db: getFirestore(), sourceBucket: getStorage().bucket(), enqueueEnrichment: submitPendingEnrichmentBatch,
  });
  return result.kind === "failed" && result.retryable ? { status: 503, retryable: true } : { status: 204 };
};
