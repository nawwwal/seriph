import { randomUUID } from "crypto";
import type { Firestore, DocumentReference, Transaction } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { catalogFamilyDocId } from "../../storage/catalogIdentity";
import { FAMILIES_COLLECTION } from "../../storage/familyStore";
import { enrichmentJobId, type EnrichmentJob, type EnrichmentJobKey, type EnrichmentJobProvenance, type EnrichmentJobState } from "./jobTypes";

export { enrichmentJobId } from "./jobTypes";
export const ENRICHMENT_JOBS_COLLECTION = "enrichmentJobs";
export const ENRICHMENT_JOBS = ENRICHMENT_JOBS_COLLECTION;

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

export interface EnrichmentJobClaimOptions {
  now?: Date;
  leaseMs?: number;
}

const REALTIME_LEASED_STATES = new Set<EnrichmentJobState>(["rendering", "submitting", "analyzing", "embedding", "indexing"]);
const DEFAULT_LEASE_MS = 10 * 60_000;

function timestampMs(value: unknown): number | undefined {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    const parsed = value.toMillis();
    return typeof parsed === "number" ? parsed : undefined;
  }
  return undefined;
}

function canClaim(job: EnrichmentJob, nowMs: number): boolean {
  if (job.state === "queued") return true;
  if (job.state === "retrying") return timestampMs(job.retryAt) === undefined || timestampMs(job.retryAt)! <= nowMs;
  return REALTIME_LEASED_STATES.has(job.state) && (timestampMs(job.leaseExpiresAt) ?? 0) <= nowMs;
}

/** Claim the job and mark its canonical family in one transaction. */
export async function claimEnrichmentJob(
  db: Firestore, jobId: string, options: EnrichmentJobClaimOptions = {},
): Promise<EnrichmentJob | null> {
  const now = options.now ?? new Date();
  const leaseExpiresAt = new Date(now.getTime() + (options.leaseMs ?? DEFAULT_LEASE_MS));
  const leaseId = randomUUID();
  return db.runTransaction(async (tx) => {
    const jobRef = enrichmentJobRef(db, jobId);
    const jobSnap = await tx.get(jobRef);
    if (!jobSnap.exists) return null;
    const prior = { ...jobSnap.data(), jobId: jobSnap.id } as EnrichmentJob;
    if (!canClaim(prior, now.getTime())) return null;

    const familyRef = db.collection(FAMILIES_COLLECTION).doc(catalogFamilyDocId(prior.ownerId, prior.familyId));
    const familySnap = await tx.get(familyRef);
    const family = familySnap.data();
    if (!familySnap.exists) {
      tx.set(jobRef, {
        state: "failed", failureCode: "family_missing", leaseId: FieldValue.delete(), leaseExpiresAt: FieldValue.delete(),
        retryAt: FieldValue.delete(), updatedAt: now, failedAt: now,
      }, { merge: true });
      return null;
    }
    if (family?.version !== prior.familyVersion || family.hidden === true || family.status === "merged") {
      tx.set(jobRef, {
        state: "failed", failureCode: "family_stale", leaseId: FieldValue.delete(), leaseExpiresAt: FieldValue.delete(),
        retryAt: FieldValue.delete(), updatedAt: now, failedAt: now,
      }, { merge: true });
      return null;
    }
    tx.set(jobRef, {
      state: "rendering", leaseId, leaseExpiresAt, attempt: Number(prior.attempt ?? 0), updatedAt: now,
      failureCode: FieldValue.delete(), failureReasons: FieldValue.delete(), retryAt: FieldValue.delete(),
    }, { merge: true });
    tx.set(familyRef, {
      status: "enriching", enrichmentJobId: jobId, enrichmentJobVersion: prior.familyVersion,
      enrichmentLeaseExpiresAt: leaseExpiresAt, updatedAt: now,
    }, { merge: true });
    return { ...prior, state: "rendering", leaseId, leaseExpiresAt, updatedAt: now };
  });
}

/** Advance a claimed job without allowing an expired worker to write over its successor. */
export async function updateClaimedEnrichmentJob(
  db: Firestore, job: EnrichmentJob, state: EnrichmentJobState, now = new Date(),
): Promise<boolean> {
  return db.runTransaction(async (tx) => {
    const ref = enrichmentJobRef(db, job.jobId);
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data()?.leaseId !== job.leaseId) return false;
    tx.set(ref, { state, updatedAt: now }, { merge: true });
    return true;
  });
}

/** Requeue a failed attempt only when this worker still owns the lease. */
export async function releaseClaimedEnrichmentJob(
  db: Firestore, job: EnrichmentJob, failureCode: string, retry: { state: "retrying" | "failed"; attempt: number; delayMs: number | null }, now = new Date(),
): Promise<boolean> {
  return db.runTransaction(async (tx) => {
    const ref = enrichmentJobRef(db, job.jobId);
    const familyRef = db.collection(FAMILIES_COLLECTION).doc(catalogFamilyDocId(job.ownerId, job.familyId));
    const [snap, familySnap] = await Promise.all([tx.get(ref), tx.get(familyRef)]);
    if (!snap.exists || snap.data()?.leaseId !== job.leaseId) return false;
    tx.set(ref, {
      state: retry.state, attempt: retry.attempt, failureCode,
      ...(retry.delayMs === null ? { failedAt: now, retryAt: FieldValue.delete() } : { retryAt: new Date(now.getTime() + retry.delayMs) }),
      leaseId: FieldValue.delete(), leaseExpiresAt: FieldValue.delete(), updatedAt: now,
    }, { merge: true });
    if (familySnap.exists && familySnap.data()?.enrichmentJobId === job.jobId) {
      tx.set(familyRef, {
        status: "ready", enrichmentJobId: FieldValue.delete(), enrichmentJobVersion: FieldValue.delete(),
        enrichmentLeaseExpiresAt: FieldValue.delete(), updatedAt: now,
      }, { merge: true });
    }
    return true;
  });
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
