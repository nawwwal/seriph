import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { isVertexEnabled } from "../../ai/vertex/vertexClient";
import { renderFamilySpecimen } from "../../ai/enrichFont";
import { getConfigNumber } from "../../config/remoteConfig";
import { RC_DEFAULTS, RC_KEYS } from "../../config/rcKeys";
import { FAMILIES_COLLECTION } from "../../storage/familyStore";
import { catalogFamilyDocId } from "../../storage/catalogIdentity";
import { submitPendingEnrichmentBatch } from "../../ingest/batch/submit";
import { collectEnrichmentJobs, type CollectEnrichmentJobsResult } from "./collector";
import { ENRICHMENT_JOBS_COLLECTION, firestoreEnrichmentJobStore } from "./jobStore";
import type { EnrichmentJob } from "./jobTypes";
import type { FontFamilyDoc } from "../../models/catalog.models";

const COLLECTABLE_STATES = ["queued", "retrying"];

export interface ProductionEnrichmentCollectorDependencies {
  db?: Firestore;
  enabled?: boolean;
  maxBatchSize?: number;
  listJobs?: () => Promise<readonly EnrichmentJob[]>;
  loadFamily?: (job: EnrichmentJob) => Promise<FontFamilyDoc | undefined>;
  render?: (family: FontFamilyDoc) => Promise<unknown>;
  markState?: (job: EnrichmentJob, state: EnrichmentJob["state"], details?: { code?: string; reasons?: string[] }) => Promise<void>;
  dispatch?: (jobs: readonly EnrichmentJob[]) => Promise<void>;
}

async function queuedJobs(db: Firestore, limit: number): Promise<readonly EnrichmentJob[]> {
  const snap = await db.collection(ENRICHMENT_JOBS_COLLECTION)
    .where("state", "in", COLLECTABLE_STATES)
    .limit(limit)
    .get();
  return snap.docs.map((doc) => ({ ...doc.data(), jobId: doc.id }) as EnrichmentJob);
}

export async function collectPendingEnrichmentJobs(
  deps: ProductionEnrichmentCollectorDependencies = {},
): Promise<CollectEnrichmentJobsResult> {
  const db = deps.db ?? (deps.listJobs && deps.loadFamily && deps.markState ? undefined : getFirestore());
  const maxBatchSize = deps.maxBatchSize ?? getConfigNumber(RC_KEYS.enrichBatchMax, Number(RC_DEFAULTS[RC_KEYS.enrichBatchMax]));
  const store = db ? firestoreEnrichmentJobStore(db) : undefined;
  const jobs = deps.listJobs ? await deps.listJobs() : await queuedJobs(db!, maxBatchSize);
  const loadFamily = deps.loadFamily ?? (async (job: EnrichmentJob) => {
    const snap = await db!.collection(FAMILIES_COLLECTION).doc(catalogFamilyDocId(job.ownerId, job.familyId)).get();
    return snap.exists ? ({ ...snap.data(), id: snap.id } as FontFamilyDoc) : undefined;
  });
  return collectEnrichmentJobs({
    enabled: deps.enabled ?? isVertexEnabled(),
    jobs,
    maxBatchSize,
    loadFamily,
    render: deps.render ?? renderFamilySpecimen,
    markState: deps.markState ?? ((job, state, details) => store!.updateState(job.jobId, state, details)),
    submit: deps.dispatch ?? (async (accepted) => { await submitPendingEnrichmentBatch(accepted); }),
  });
}
