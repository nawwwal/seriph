import type { Firestore, Transaction } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { enrichmentJobId, type EnrichmentJob, type EnrichmentJobKey, type EnrichmentJobProvenance, type EnrichmentJobState } from "./jobTypes";
import {
  ENRICHMENT_JOBS,
  ENRICHMENT_JOBS_COLLECTION,
  claimEnrichmentJob,
  enrichmentJobRef,
  releaseClaimedEnrichmentJob,
  updateClaimedEnrichmentJob,
  type EnrichmentJobClaimOptions,
} from "./jobClaim";

export {
  ENRICHMENT_JOBS,
  ENRICHMENT_JOBS_COLLECTION,
  claimEnrichmentJob,
  enrichmentJobId,
  enrichmentJobRef,
  releaseClaimedEnrichmentJob,
  updateClaimedEnrichmentJob,
  type EnrichmentJobClaimOptions,
};

export interface CreateEnrichmentJobInput extends Omit<EnrichmentJobKey, "ownerId"> {
  ownerId: string;
  batchId: string;
  planVersion: number;
  provenance?: EnrichmentJobProvenance;
  now?: Date;
}

export type EnrichmentJobCommitInput = Omit<CreateEnrichmentJobInput, "familyVersion" | "now">;

export interface EnrichmentJobStore {
  create(input: CreateEnrichmentJobInput): Promise<EnrichmentJob>;
  updateState(jobId: string, state: EnrichmentJobState, details?: { code?: string; reasons?: string[] }): Promise<void>;
}

type TransactionLike = Pick<Transaction, "get" | "set">;

export function jobFromInput(input: CreateEnrichmentJobInput): EnrichmentJob {
  const { now = new Date(), ...key } = input;
  return {
    ...key,
    jobId: enrichmentJobId(key),
    state: "queued",
    createdAt: now,
    updatedAt: now,
  };
}

/** Idempotently queue a current-version backfill job, including its audit provenance. */
export async function ensureQueuedEnrichmentJob(
  db: Firestore, input: CreateEnrichmentJobInput, provenance: EnrichmentJobProvenance,
): Promise<{ job: EnrichmentJob; created: boolean; requeued: boolean }> {
  const job = jobFromInput({ ...input, provenance });
  return db.runTransaction(async (tx) => {
    const ref = enrichmentJobRef(db, job.jobId);
    const priorSnap = await tx.get(ref);
    const prior = priorSnap.exists ? ({ ...priorSnap.data(), jobId: ref.id } as EnrichmentJob) : undefined;
    if (prior && ["queued", "rendering", "submitting", "analyzing", "embedding", "indexing", "retrying"].includes(prior.state)) {
      return { job: prior, created: false, requeued: false };
    }
    const next = { ...job, ...(prior ? { attempt: 0 } : {}), updatedAt: input.now ?? new Date() };
    const write = prior
      ? { ...next, leaseId: FieldValue.delete(), leaseExpiresAt: FieldValue.delete(), retryAt: FieldValue.delete(),
        failureCode: FieldValue.delete(), failureReasons: FieldValue.delete() }
      : next;
    tx.set(ref, write, { merge: priorSnap.exists });
    return { job: next, created: !priorSnap.exists, requeued: Boolean(priorSnap.exists) };
  });
}

/** Writes a job idempotently. This helper can be called with an outer family transaction. */
export async function writeEnrichmentJob(
  tx: TransactionLike, db: Firestore, input: CreateEnrichmentJobInput,
): Promise<EnrichmentJob> {
  const job = jobFromInput(input);
  const ref = enrichmentJobRef(db, job.jobId);
  const prior = await tx.get(ref);
  if (!prior.exists) tx.set(ref, job);
  return (prior.exists ? prior.data() : job) as EnrichmentJob;
}

export function firestoreEnrichmentJobStore(db: Firestore, now: () => Date = () => new Date()): EnrichmentJobStore {
  return {
    async create(input) {
      let result!: EnrichmentJob;
      await db.runTransaction(async (tx) => { result = await writeEnrichmentJob(tx, db, { ...input, now: now() }); });
      return result;
    },
    async updateState(jobId, state, details = {}) {
      await enrichmentJobRef(db, jobId).set({
        state,
        ...(details.code ? { failureCode: details.code } : {}),
        ...(details.reasons ? { failureReasons: details.reasons } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    },
  };
}
