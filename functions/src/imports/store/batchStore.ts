import { FieldValue, Firestore } from "firebase-admin/firestore";
import { ImportBatch, ImportBatchCounters } from "../contracts/batch";
import { importBatchRef } from "./paths";

export type CreateBatchInput = Pick<ImportBatch,
  "ownerId" | "batchId" | "label" | "expectedSourceCount">;
export type CreateBatchResult = { kind: "created" } | { kind: "exists" };

const counters = (): ImportBatchCounters => ({
  sources: 0, discoveredItems: 0, fonts: 0, families: 0,
  duplicates: 0, review: 0, warnings: 0, failures: 0,
});

export const createBatch = async (
  db: Firestore, input: CreateBatchInput,
): Promise<CreateBatchResult> => db.runTransaction(async (tx) => {
  const ref = importBatchRef(db, input.ownerId, input.batchId);
  if ((await tx.get(ref)).exists) return { kind: "exists" };
  const now = FieldValue.serverTimestamp() as unknown as string;
  tx.set(ref, {
    ...input, schemaVersion: 1, sealed: false, planVersion: 0, outcome: "active",
    counters: counters(), createdAt: now, updatedAt: now,
    archiveBudget: { reservedBytes: 0, maxBytes: 0, reservations: {} },
    phases: {
      upload: { state: "registered", attempts: 0, updatedAt: now },
      planning: { state: "building", attempts: 0, updatedAt: now },
      enrichment: { state: "blocked", attempts: 0, updatedAt: now },
    },
  });
  return { kind: "created" };
});

export type ArchiveBudgetReservation =
  | { kind: "reserved" | "exists" | "exceeded"; reservedBytes: number; remainingBytes: number; reservationBytes: number }
  | { kind: "batch_missing"; reservedBytes: 0; remainingBytes: 0 };

export async function reserveArchiveBytesOnce(
  db: Firestore, input: { ownerId: string; batchId: string; reservationId: string; bytes: number; maxBytes: number },
): Promise<ArchiveBudgetReservation> {
  if (!input.reservationId.trim() || !Number.isSafeInteger(input.bytes) || input.bytes < 0 ||
    !Number.isSafeInteger(input.maxBytes) || input.maxBytes < 0) throw new Error("invalid archive budget reservation");
  return db.runTransaction(async (tx) => {
    const ref = importBatchRef(db, input.ownerId, input.batchId); const snap = await tx.get(ref);
    if (!snap.exists) return { kind: "batch_missing", reservedBytes: 0, remainingBytes: 0 };
    const current = snap.data() as { archiveBudget?: { reservedBytes?: number; maxBytes?: number; reservations?: Record<string, number> } };
    const budget = { reservedBytes: current.archiveBudget?.reservedBytes ?? 0, maxBytes: current.archiveBudget?.maxBytes ?? 0, reservations: current.archiveBudget?.reservations ?? {} };
    const existing = budget.reservations[input.reservationId]; const maxBytes = budget.maxBytes > 0 ? budget.maxBytes : input.maxBytes;
    if (existing !== undefined) return { kind: "exists", reservedBytes: budget.reservedBytes, remainingBytes: Math.max(0, maxBytes - budget.reservedBytes), reservationBytes: existing };
    if (budget.reservedBytes + input.bytes > maxBytes) return { kind: "exceeded", reservedBytes: budget.reservedBytes, remainingBytes: Math.max(0, maxBytes - budget.reservedBytes), reservationBytes: 0 };
    const next = { reservedBytes: budget.reservedBytes + input.bytes, maxBytes, reservations: { ...budget.reservations, [input.reservationId]: input.bytes } };
    tx.update(ref, { archiveBudget: next, updatedAt: FieldValue.serverTimestamp() });
    return { kind: "reserved", reservedBytes: next.reservedBytes, remainingBytes: maxBytes - next.reservedBytes, reservationBytes: input.bytes };
  });
}
