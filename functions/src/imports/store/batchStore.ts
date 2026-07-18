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
    registeredSourceCount: 0, counters: counters(), createdAt: now, updatedAt: now,
    phases: {
      upload: { state: "registered", attempts: 0, updatedAt: now },
      planning: { state: "building", attempts: 0, updatedAt: now },
      enrichment: { state: "blocked", attempts: 0, updatedAt: now },
    },
  });
  return { kind: "created" };
});
