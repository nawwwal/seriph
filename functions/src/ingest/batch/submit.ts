import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { isVertexEnabled } from "../../ai/vertex/vertexClient";
import { RC_KEYS, RC_DEFAULTS } from "../../config/rcKeys";
import { getConfigNumber } from "../../config/remoteConfig";
import type { EnrichmentJob } from "../../enrichment/jobs/jobTypes";
import { ENRICHMENT_JOBS_COLLECTION } from "../../enrichment/jobs/jobStore";
import { batchEnrichEnabled } from "./client";
import { processRealtimeEnrichmentJob } from "../../enrichment/realtime/processJob";

export { buildSubmissionCandidates } from "../../enrichment/preflight";
export type { ProviderRunRecord } from "./submissionStore";

const COLLECTABLE_STATES = ["queued", "retrying"];
const CONCURRENCY = 4;

async function processJobs(db: FirebaseFirestore.Firestore, jobs: readonly EnrichmentJob[]): Promise<boolean[]> {
  const results = new Array<boolean>(jobs.length); let cursor = 0;
  const worker = async () => { while (cursor < jobs.length) { const index = cursor++; results[index] = await processRealtimeEnrichmentJob(db, jobs[index]!); } };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
  return results;
}

export async function submitPendingEnrichmentBatch(selectedJobs?: readonly EnrichmentJob[]): Promise<{ selected: number; submitted: number; rejected: number; jobName?: string }> {
  if (!batchEnrichEnabled() || !isVertexEnabled()) {
    logger.info("[batch] enrichment disabled (kill-switch); skipping submit. selected 0, submitted 0, rejected 0.");
    return { selected: 0, submitted: 0, rejected: 0 };
  }
  const db = getFirestore();
  const jobs = selectedJobs ?? await queuedJobs(db);
  if (!jobs.length) {
    logger.info("[batch] no pending families to enrich. selected 0, submitted 0, rejected 0.");
    return { selected: 0, submitted: 0, rejected: 0 };
  }
  const completed = await processJobs(db, jobs);
  return { selected: jobs.length, submitted: completed.filter(Boolean).length, rejected: completed.filter((value) => !value).length };
}

async function queuedJobs(db: FirebaseFirestore.Firestore): Promise<readonly EnrichmentJob[]> {
  const limit = getConfigNumber(RC_KEYS.enrichBatchMax, Number(RC_DEFAULTS[RC_KEYS.enrichBatchMax]));
  const snap = await db.collection(ENRICHMENT_JOBS_COLLECTION).where("state", "in", COLLECTABLE_STATES).limit(limit).get();
  return snap.docs.map((doc) => ({ ...doc.data(), jobId: doc.id }) as EnrichmentJob);
}
