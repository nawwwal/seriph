import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { isVertexEnabled } from "../../ai/vertex/vertexClient";
import { RC_KEYS, RC_DEFAULTS } from "../../config/rcKeys";
import { getConfigNumber } from "../../config/remoteConfig";
import type { EnrichmentJob } from "../../enrichment/jobs/jobTypes";
import { ENRICHMENT_JOBS_COLLECTION } from "../../enrichment/jobs/jobStore";
import { buildSubmissionCandidates } from "../../enrichment/preflight";
import { batchEnrichEnabled } from "./client";
import { submitProviderJobs } from "./providerSubmission";

export { buildSubmissionCandidates } from "../../enrichment/preflight";
export type { ProviderRunRecord } from "./submissionStore";

const COLLECTABLE_STATES = ["queued", "retrying"];

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
  return submitProviderJobs(db, jobs);
}

async function queuedJobs(db: FirebaseFirestore.Firestore): Promise<readonly EnrichmentJob[]> {
  const limit = getConfigNumber(RC_KEYS.enrichBatchMax, Number(RC_DEFAULTS[RC_KEYS.enrichBatchMax]));
  const snap = await db.collection(ENRICHMENT_JOBS_COLLECTION).where("state", "in", COLLECTABLE_STATES).limit(limit).get();
  return snap.docs.map((doc) => ({ ...doc.data(), jobId: doc.id }) as EnrichmentJob);
}
