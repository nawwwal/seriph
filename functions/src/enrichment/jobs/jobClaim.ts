import { randomUUID } from "crypto";
import type { Firestore, DocumentReference, Transaction } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { catalogFamilyDocCandidates, catalogFamilyDocId } from "../../storage/catalogIdentity";
import { FAMILIES_COLLECTION } from "../../storage/familyStore";
import { type EnrichmentJob, type EnrichmentJobState } from "./jobTypes";

export const ENRICHMENT_JOBS_COLLECTION = "enrichmentJobs";
export const ENRICHMENT_JOBS = ENRICHMENT_JOBS_COLLECTION;

export interface EnrichmentJobClaimOptions {
  now?: Date;
  leaseMs?: number;
}

type TransactionLike = Pick<Transaction, "get" | "set">;
const REALTIME_LEASED_STATES = new Set<EnrichmentJobState>(["rendering", "submitting", "analyzing", "embedding", "indexing"]);
const DEFAULT_LEASE_MS = 10 * 60_000;

export function enrichmentJobRef(db: Firestore, jobId: string): DocumentReference {
  return db.collection(ENRICHMENT_JOBS_COLLECTION).doc(jobId);
}

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

async function familyDocInTx(tx: TransactionLike, db: Firestore, ownerId: string, familyId: string) {
  const col = db.collection(FAMILIES_COLLECTION);
  for (const id of catalogFamilyDocCandidates(ownerId, familyId)) {
    const ref = col.doc(id);
    const snap = await tx.get(ref);
    if (snap.exists) return { ref, snap };
  }
  const ref = col.doc(catalogFamilyDocId(ownerId, familyId));
  return { ref, snap: await tx.get(ref) };
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

    const { ref: familyRef, snap: familySnap } = await familyDocInTx(tx, db, prior.ownerId, prior.familyId);
    const family = familySnap.data();
    if (!familySnap.exists || !family) {
      tx.set(jobRef, {
        state: "failed", failureCode: "family_missing", leaseId: FieldValue.delete(), leaseExpiresAt: FieldValue.delete(),
        retryAt: FieldValue.delete(), updatedAt: now, failedAt: now,
      }, { merge: true });
      return null;
    }
    if (Number(family?.version ?? 0) !== Number(prior.familyVersion ?? 0) || family.hidden === true || family.status === "merged") {
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
    const { ref: familyRef, snap: familySnap } = await familyDocInTx(tx, db, job.ownerId, job.familyId);
    const snap = await tx.get(ref);
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
