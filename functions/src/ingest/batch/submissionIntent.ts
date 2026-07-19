import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { FAMILIES_COLLECTION } from "../../storage/familyStore";
import type { EnrichmentJob } from "../../enrichment/jobs/jobTypes";
import type { FontFamilyDoc } from "../../models/catalog.models";
import type { ProviderRejectedJob } from "../../enrichment/provider/buildInput";
import { jobRef, type ProviderRunRecord } from "./submissionStore";

function rejectionData(rejection: ProviderRejectedJob, runId: string) {
  return {
    state: "failed", providerRunId: runId, failureCode: rejection.code,
    failureReasons: [rejection.code], failedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

export async function persistRejectedJobs(
  db: Firestore, runId: string, rejected: readonly ProviderRejectedJob[],
): Promise<void> {
  if (!rejected.length) return;
  const writer = db.batch();
  for (const rejection of rejected) writer.set(jobRef(db, rejection.jobId), rejectionData(rejection, runId), { merge: true });
  await writer.commit();
}

export async function persistSubmissionIntent(
  db: Firestore, record: ProviderRunRecord, jobs: readonly EnrichmentJob[],
  families: readonly FontFamilyDoc[], rejected: readonly ProviderRejectedJob[], leaseExpiresAt: Date,
): Promise<"prepared" | "existing"> {
  let result: "prepared" | "existing" = "prepared";
  await db.runTransaction(async (tx) => {
    const ref = db.collection("batchJobs").doc(record.id); const prior = await tx.get(ref);
    const current = prior.exists ? prior.data() as Partial<ProviderRunRecord> : undefined;
    if (current?.submissionState === "submitted" || current?.submissionState === "provider_created") { result = "existing"; return; }
    if (current?.submissionState === "unknown") throw new Error(`provider submission needs reconciliation: ${record.id}`);
    if (current && JSON.stringify(current.expectedJobIds) !== JSON.stringify(record.expectedJobIds)) throw new Error(`provider expected set changed: ${record.id}`);
    tx.set(ref, { ...record, state: "SUBMISSION_SUBMITTING", submissionState: "submitting", leaseExpiresAt, createdAt: current?.createdAt ?? FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    const expected = new Set(record.expectedJobIds);
    for (const job of jobs) if (expected.has(job.jobId)) tx.set(jobRef(db, job.jobId), { state: "submitting", providerRunId: record.id, leaseExpiresAt, submissionState: "submitting", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    for (const family of families) tx.set(db.collection(FAMILIES_COLLECTION).doc(family.id), { status: "enriching", enrichmentJobId: record.id, enrichmentJobVersion: family.version ?? 1, enrichmentLeaseExpiresAt: leaseExpiresAt, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    for (const rejection of rejected) tx.set(jobRef(db, rejection.jobId), rejectionData(rejection, record.id), { merge: true });
  });
  return result;
}
