import type { DocumentReference, Transaction } from "firebase-admin/firestore";

export interface TaskLeaseDocument {
  state?: string;
  attempt?: number;
  leaseExpiresAt?: Date | string | number | { toDate: () => Date };
}
export type TaskLeaseClaim = { kind: "claimed"; attempt: number } | { kind: "busy" };
type LeaseReference = Pick<DocumentReference, "firestore">;
const MAX_LEASE_SECONDS = 86_400;
const MAX_DATE_MS = 8_640_000_000_000_000;

function asDate(value: TaskLeaseDocument["leaseExpiresAt"]): Date | undefined {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  if (typeof value === "string" || typeof value === "number") {
    const result = new Date(value);
    return Number.isNaN(result.getTime()) ? undefined : result;
  }
  if (value && typeof value.toDate === "function") return asDate(value.toDate());
  return undefined;
}
function leaseDurationMs(): number {
  const raw = process.env.IMPORT_TASK_LEASE_SECONDS ?? "300";
  if (!/^\d+$/.test(raw)) throw new Error("Invalid import task lease duration");
  const seconds = Number(raw);
  if (!Number.isSafeInteger(seconds) || seconds < 1 || seconds > MAX_LEASE_SECONDS) throw new Error("Invalid import task lease duration");
  return seconds * 1000;
}
function expiry(now: Date, durationMs: number): Date {
  const nowMs = now.getTime();
  if (!Number.isSafeInteger(nowMs) || nowMs > MAX_DATE_MS - durationMs) throw new Error("Import task lease expiry overflows Date");
  const result = new Date(nowMs + durationMs);
  if (Number.isNaN(result.getTime())) throw new Error("Import task lease expiry overflows Date");
  return result;
}
function storedAttempt(current: TaskLeaseDocument): number {
  if (!Object.prototype.hasOwnProperty.call(current, "attempt") || !Number.isSafeInteger(current.attempt)
    || (current.attempt as number) < 0) throw new Error("Invalid stored lease attempt");
  return current.attempt as number;
}
function canClaim(current: TaskLeaseDocument | undefined, now: Date): boolean {
  if (!current || current.state !== "retryable") return !current;
  const expiresAt = asDate(current.leaseExpiresAt);
  return expiresAt !== undefined && expiresAt.getTime() <= now.getTime();
}
export async function claimTaskLease(ref: LeaseReference, now = new Date()): Promise<TaskLeaseClaim> {
  const durationMs = leaseDurationMs();
  return ref.firestore.runTransaction(async (transaction: Transaction) => {
    const snapshot = await transaction.get(ref as DocumentReference);
    const current = snapshot.exists ? snapshot.data() as TaskLeaseDocument : undefined;
    if (!canClaim(current, now)) return { kind: "busy" };
    const attempt = (current ? storedAttempt(current) : 0) + 1;
    if (!Number.isSafeInteger(attempt)) throw new Error("Import task lease attempt overflows");
    transaction.set(ref as DocumentReference, { state: "leased", attempt, leaseStartedAt: now,
      leaseExpiresAt: expiry(now, durationMs) }, { merge: true });
    return { kind: "claimed", attempt };
  });
}

/** Return a failed delivery to Cloud Tasks immediately instead of waiting for its lease to expire. */
export async function releaseTaskLease(ref: LeaseReference, attempt: number, now = new Date()): Promise<void> {
  await ref.firestore.runTransaction(async (transaction: Transaction) => {
    const snapshot = await transaction.get(ref as DocumentReference);
    const current = snapshot.exists ? snapshot.data() as TaskLeaseDocument : undefined;
    if (!current || current.state !== "leased" || current.attempt !== attempt) return;
    transaction.set(ref as DocumentReference, { state: "retryable", leaseExpiresAt: now, updatedAt: now }, { merge: true });
  });
}

export async function completeTaskLease(ref: LeaseReference, attempt: number, now = new Date()): Promise<void> {
  await ref.firestore.runTransaction(async (transaction: Transaction) => {
    const snapshot = await transaction.get(ref as DocumentReference);
    const current = snapshot.exists ? snapshot.data() as TaskLeaseDocument : undefined;
    if (!current || current.state !== "leased" || current.attempt !== attempt) return;
    transaction.set(ref as DocumentReference, { state: "complete", completedAt: now, leaseExpiresAt: now }, { merge: true });
  });
}
