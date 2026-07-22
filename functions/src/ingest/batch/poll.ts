import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { JOBS_COLLECTION, ACTIVE_STATES, SUCCESS_STATES, FAIL_STATES, batchClient } from "./client";
import { readOutputLines } from "./output";
import { reconcileProviderOutput } from "../../enrichment/provider/reconcileOutput";
import { retryState } from "../../enrichment/jobs/retryPolicy";

interface JobDoc {
  jobName: string;
  state: string;
  slugs: string[];
  familyIds?: string[];
  bucket: string;
  outputPrefix: string;
  expectedJobIds?: string[];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function timestampMs(value: unknown): number | undefined { if (value instanceof Date) return value.getTime(); if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") return timestampMs(value.toDate()); const parsed = typeof value === "string" || typeof value === "number" ? new Date(value).getTime() : NaN; return Number.isFinite(parsed) ? parsed : undefined; }

/** Return expired provider leases to the bounded job retry lane. */
export async function watchExpiredEnrichmentLeases(now = new Date()): Promise<number> {
  const db = getFirestore();
  const snap = await db.collection("enrichmentJobs").where("state", "in", ["submitted", "analyzing", "embedding"])
    .where("leaseExpiresAt", "<=", now).get();
  let reclaimed = 0;
  for (const doc of snap.docs) {
    const data = doc.data() as Record<string, unknown>;
    const attempt = Number(data.attempt ?? 0); const plan = retryState(attempt);
    const leaseExpiresAt = timestampMs(data.leaseExpiresAt);
    await db.runTransaction(async (tx) => {
      const current = await tx.get(doc.ref);
      const currentData = current.exists ? current.data() as Record<string, unknown> : undefined;
      if (!currentData || currentData.state !== data.state || timestampMs(currentData.leaseExpiresAt) !== leaseExpiresAt
        || leaseExpiresAt === undefined || leaseExpiresAt > now.getTime()) return;
      tx.set(doc.ref, {
        state: plan.state, attempt: plan.attempt, failureCode: "lease_expired",
        ...(plan.delayMs === null ? { failedAt: FieldValue.serverTimestamp() } : { retryAt: new Date(now.getTime() + plan.delayMs) }),
        leaseExpiresAt: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      if (typeof data.providerRunId === "string") tx.set(db.collection(JOBS_COLLECTION).doc(data.providerRunId), {
        reconciliationRequestedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      reclaimed++;
    });
  }
  return reclaimed;
}

/**
 * Check active batch jobs. On success, parse output, embed + write each family,
 * and finalize ingests. On failure, return families to `ready` for the next run.
 */
export async function pollEnrichmentBatches(): Promise<{ checked: number; completed: number }> {
  const db = getFirestore();
  const snap = await db.collection(JOBS_COLLECTION).where("state", "in", ACTIVE_STATES).get();
  if (snap.empty) return { checked: 0, completed: 0 };

  let completed = 0;
  for (const jobDoc of snap.docs) {
    const job = jobDoc.data() as JobDoc;
    let state = job.state;
    try {
      const live = await batchClient().batches.get({ name: job.jobName });
      state = (live.state as string) ?? state;
    } catch (error) {
      logger.warn(`[batch] get failed for ${job.jobName}`, { message: errorMessage(error) });
      continue;
    }

    if (ACTIVE_STATES.includes(state)) {
      await jobDoc.ref.update({ state, updatedAt: FieldValue.serverTimestamp() });
      continue;
    }

    if (SUCCESS_STATES.includes(state)) {
      try {
        const rows = await readOutputLines(job.bucket, job.outputPrefix);
        const result = await reconcileProviderOutput({ id: jobDoc.id, expectedJobIds: job.expectedJobIds ?? [] }, rows, { db });
        const applied = Object.values(result.byJob).filter((outcome) => outcome === "complete").length;
        completed++;
        await jobDoc.ref.update({
          state, applied, rows: rows.length, outcomes: result.byJob,
          finishedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
        });
        logger.info(`[batch] ${job.jobName} ${state}: applied ${applied}/${rows.length} rows.`);
      } catch (error) {
        const message = errorMessage(error);
        logger.error(`[batch] failed processing output for ${job.jobName}`, { message });
        await jobDoc.ref.update({ state, error: message, updatedAt: FieldValue.serverTimestamp() });
      }
      continue;
    }

    if (FAIL_STATES.includes(state)) {
      const result = await reconcileProviderOutput({ id: jobDoc.id, expectedJobIds: job.expectedJobIds ?? [] }, [], { db });
      const writer = db.batch();
      writer.update(jobDoc.ref, { state, finishedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      await writer.commit();
      logger.warn(`[batch] ${job.jobName} ${state}; reconciled ${Object.keys(result.byJob).length} expected jobs.`);
    }
  }

  return { checked: snap.size, completed };
}
