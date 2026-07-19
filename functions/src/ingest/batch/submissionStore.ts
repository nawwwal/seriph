import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { ENRICHMENT_JOBS_COLLECTION } from "../../enrichment/jobs/jobStore";

export type ProviderSubmissionState = "submitting" | "provider_created" | "submitted" | "failed" | "unknown";

export interface ProviderRunRecord {
  id: string;
  providerJobName: string;
  expectedJobIds: string[];
  inputUri: string;
  outputPrefix: string;
  state: string;
  submissionState: ProviderSubmissionState;
  bucket?: string;
  slugs?: string[];
  familyIds?: string[];
  createdAt?: unknown;
}

export interface ProviderSubmissionResult {
  name: string;
  state?: string;
}

export const runRef = (db: Firestore, id: string) => db.collection("batchJobs").doc(id);
export const jobRef = (db: Firestore, id: string) => db.collection(ENRICHMENT_JOBS_COLLECTION).doc(id);

export async function recordProviderSubmission(
  db: Firestore, runId: string, provider: ProviderSubmissionResult,
): Promise<void> {
  if (!provider.name) throw new Error("provider submission returned no job name");
  await db.runTransaction(async (tx) => {
    const ref = runRef(db, runId); const snap = await tx.get(ref);
    if (!snap.exists) throw new Error(`provider submission intent missing: ${runId}`);
    const current = snap.data() as Partial<ProviderRunRecord>;
    if (current.submissionState === "submitted") return;
    if (current.providerJobName && current.providerJobName !== provider.name) throw new Error("provider job identity changed");
    tx.set(ref, {
      providerJobName: provider.name, jobName: provider.name, state: provider.state ?? "JOB_STATE_PENDING",
      submissionState: "provider_created", updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

export async function finalizeProviderSubmission(db: Firestore, runId: string): Promise<void> {
  await db.runTransaction(async (tx) => {
    const ref = runRef(db, runId); const snap = await tx.get(ref);
    if (!snap.exists) throw new Error(`provider submission intent missing: ${runId}`);
    const record = snap.data() as ProviderRunRecord;
    if (record.submissionState === "submitted") return;
    if (!record.providerJobName) throw new Error(`provider job identity missing: ${runId}`);
    for (const jobId of record.expectedJobIds) tx.set(jobRef(db, jobId), {
      state: "submitted", providerRunId: runId, providerJobName: record.providerJobName,
      submissionState: "submitted", submittedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(ref, { state: record.state || "JOB_STATE_PENDING", submissionState: "submitted", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
}

export async function reconcileProviderSubmission(db: Firestore, runId: string): Promise<boolean> {
  const snap = await runRef(db, runId).get();
  if (!snap.exists) return false;
  const record = snap.data() as ProviderRunRecord;
  if (record.submissionState === "submitted") return true;
  if (record.submissionState !== "provider_created" || !record.providerJobName) return false;
  await finalizeProviderSubmission(db, runId);
  return true;
}

export async function finalizeProviderFailure(
  db: Firestore, runId: string, error: unknown, phase: "input" | "provider",
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await db.runTransaction(async (tx) => {
    const ref = runRef(db, runId); const snap = await tx.get(ref);
    if (!snap.exists) return;
    const record = snap.data() as ProviderRunRecord;
    if (record.submissionState === "submitted" || record.submissionState === "provider_created") return;
    const unknown = phase === "provider";
    tx.set(ref, {
      state: unknown ? "SUBMISSION_UNKNOWN" : "JOB_STATE_FAILED",
      submissionState: unknown ? "unknown" : "failed", failureCode: message,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    for (const jobId of record.expectedJobIds) tx.set(jobRef(db, jobId), {
      ...(unknown ? { submissionState: "unknown" } : { state: "retrying" }),
      failureCode: message, failureReasons: [message], updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}
