import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getFirestore } from "firebase-admin/firestore";
import { importBatchRef } from "../imports/store/paths";
import { firestoreReconcileDependencies, reconcileBatch } from "../imports/reconcile/reconcileBatch";

export const syncEnrichmentBatchStatus = onDocumentWritten({
  document: "enrichmentJobs/{jobId}", region: "asia-southeast1", memory: "512MiB",
}, async (event) => {
  const job = event.data?.after.data();
  if (!job || typeof job.ownerId !== "string" || typeof job.batchId !== "string") return;
  const db = getFirestore();
  const ref = importBatchRef(db, job.ownerId, job.batchId);
  if (!(await ref.get()).exists) return;
  await reconcileBatch(ref, firestoreReconcileDependencies(db));
});
