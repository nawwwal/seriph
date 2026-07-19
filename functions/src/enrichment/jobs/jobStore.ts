import type { Firestore, DocumentReference, Transaction } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { enrichmentJobId, type EnrichmentJob, type EnrichmentJobKey, type EnrichmentJobState } from "./jobTypes";

export { enrichmentJobId } from "./jobTypes";
export const ENRICHMENT_JOBS_COLLECTION = "enrichmentJobs";
export const ENRICHMENT_JOBS = ENRICHMENT_JOBS_COLLECTION;

export interface CreateEnrichmentJobInput extends EnrichmentJobKey {
  ownerId: string;
  batchId: string;
  planVersion: number;
  now?: Date;
}

export type EnrichmentJobCommitInput = Omit<CreateEnrichmentJobInput, "familyVersion" | "now">;

export interface EnrichmentJobStore {
  create(input: CreateEnrichmentJobInput): Promise<EnrichmentJob>;
  updateState(jobId: string, state: EnrichmentJobState, details?: { code?: string; reasons?: string[] }): Promise<void>;
}

type TransactionLike = Pick<Transaction, "get" | "set">;

export function enrichmentJobRef(db: Firestore, jobId: string): DocumentReference {
  return db.collection(ENRICHMENT_JOBS_COLLECTION).doc(jobId);
}

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
