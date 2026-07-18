import type { DocumentReference, Transaction } from "firebase-admin/firestore";

export interface TaskLeaseDocument {
  state?: string;
  attempt?: number;
  leaseExpiresAt?: Date | string | number | { toDate: () => Date };
}

export type TaskLeaseClaim =
  | { kind: "claimed"; attempt: number }
  | { kind: "busy" };

type LeaseReference = Pick<DocumentReference, "firestore">;

function asDate(value: TaskLeaseDocument["leaseExpiresAt"]): Date | undefined {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const result = new Date(value);
    return Number.isNaN(result.getTime()) ? undefined : result;
  }
  if (value && typeof value.toDate === "function") return value.toDate();
  return undefined;
}

function leaseDurationMs(): number {
  const configured = Number(process.env.IMPORT_TASK_LEASE_SECONDS ?? "300");
  return Number.isFinite(configured) && configured > 0 ? configured * 1000 : 300_000;
}

function canClaim(current: TaskLeaseDocument | undefined, now: Date): boolean {
  if (!current) return true;
  if (current.state !== "retryable") return false;
  const expiresAt = asDate(current.leaseExpiresAt);
  return expiresAt !== undefined && expiresAt.getTime() <= now.getTime();
}

export async function claimTaskLease(
  ref: LeaseReference,
  now = new Date(),
): Promise<TaskLeaseClaim> {
  return ref.firestore.runTransaction(async (transaction: Transaction) => {
    const snapshot = await transaction.get(ref as DocumentReference);
    const current = snapshot.exists ? snapshot.data() as TaskLeaseDocument : undefined;
    if (!canClaim(current, now)) return { kind: "busy" };

    const currentAttempt = current?.attempt;
    const attemptNumber = typeof currentAttempt === "number" && Number.isInteger(currentAttempt)
      ? currentAttempt
      : 0;
    const attempt = Math.max(0, attemptNumber) + 1;
    transaction.set(ref as DocumentReference, {
      state: "leased",
      attempt,
      leaseStartedAt: now,
      leaseExpiresAt: new Date(now.getTime() + leaseDurationMs()),
    }, { merge: true });
    return { kind: "claimed", attempt };
  });
}
