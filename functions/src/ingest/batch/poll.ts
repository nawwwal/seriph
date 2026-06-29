import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { FAMILIES_COLLECTION } from "../../storage/familyStore";
import { JOBS_COLLECTION, ACTIVE_STATES, SUCCESS_STATES, FAIL_STATES, batchClient } from "./client";
import { readOutputLines, applyOutputRow } from "./output";

interface JobDoc {
  jobName: string;
  state: string;
  slugs: string[];
  familyIds?: string[];
  bucket: string;
  outputPrefix: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
        let applied = 0;
        for (const row of rows) {
          if (await applyOutputRow(row)) applied++;
        }
        completed++;
        await jobDoc.ref.update({
          state, applied, rows: rows.length,
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
      const writer = db.batch();
      const ids = job.familyIds ?? job.slugs ?? [];
      for (const id of ids) {
        writer.set(
          db.collection(FAMILIES_COLLECTION).doc(id),
          {
            status: "ready",
            enrichmentJobId: FieldValue.delete(),
            enrichmentJobVersion: FieldValue.delete(),
            enrichmentLeaseExpiresAt: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
      writer.update(jobDoc.ref, { state, finishedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      await writer.commit();
      logger.warn(`[batch] ${job.jobName} ${state}; returned ${ids.length} families to ready.`);
    }
  }

  return { checked: snap.size, completed };
}
