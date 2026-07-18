import { FieldValue, Firestore } from "firebase-admin/firestore";
import { ImportBatchCounters, ImportSource, ImportSourceState } from "../contracts/batch";
import { importBatchRef, importSourceRef } from "./paths";

export type SourceInput = Pick<ImportSource, "ownerId" | "batchId" | "sourceId" |
  "originalPath" | "filename" | "declaredSize" | "declaredMimeType" | "storagePath">;
type Conflict = { kind: "batch_missing" } | { kind: "source_conflict" } |
  { kind: "state_conflict"; expected: ImportSourceState; actual: ImportSourceState };
const same = (left: SourceInput, right: Record<string, unknown>) =>
  Object.entries(left).every(([key, value]) => right[key] === value);
const allowed: Partial<Record<ImportSourceState, ImportSourceState[]>> = {
  registered: ["uploading", "canceled"], uploading: ["uploaded", "failed", "timed_out"],
  uploaded: ["discovering"], discovering: ["discovered", "failed", "timed_out"],
};

export const registerSource = async (db: Firestore, input: SourceInput): Promise<{ kind: "created" | "existing" } | Conflict> =>
  db.runTransaction(async (tx) => {
    const batch = importBatchRef(db, input.ownerId, input.batchId);
    if (!(await tx.get(batch)).exists) return { kind: "batch_missing" };
    const ref = importSourceRef(db, input.ownerId, input.batchId, input.sourceId);
    const current = await tx.get(ref);
    if (current.exists) return same(input, current.data()!) ? { kind: "existing" } : { kind: "source_conflict" };
    const now = FieldValue.serverTimestamp() as unknown as string;
    tx.set(ref, { ...input, state: "registered", retryCount: 0, uploadConfirmed: false, createdAt: now, updatedAt: now });
    const data = (await tx.get(batch)).data()!;
    tx.update(batch, { registeredSourceCount: (data.registeredSourceCount as number) + 1,
      counters: { ...(data.counters as ImportBatchCounters), sources: (data.counters as ImportBatchCounters).sources + 1 }, updatedAt: now });
    return { kind: "created" };
  });

export const transitionSource = async (db: Firestore, input: SourceInput, from: ImportSourceState, to: ImportSourceState): Promise<{ kind: "transitioned" } | Conflict | { kind: "invalid_transition"; from: ImportSourceState; to: ImportSourceState }> =>
  db.runTransaction(async (tx) => {
    if (!allowed[from]?.includes(to)) return { kind: "invalid_transition", from, to };
    const ref = importSourceRef(db, input.ownerId, input.batchId, input.sourceId); const snap = await tx.get(ref);
    if (!snap.exists) return { kind: "batch_missing" }; const current = snap.data()!;
    if (!same(input, current)) return { kind: "source_conflict" };
    if (current.state !== from) return { kind: "state_conflict", expected: from, actual: current.state as ImportSourceState };
    tx.update(ref, { state: to, updatedAt: FieldValue.serverTimestamp() }); return { kind: "transitioned" };
  });

export const updateBatchSummary = async (db: Firestore, input: SourceInput, expected: ImportSourceState, delta: Partial<ImportBatchCounters>): Promise<{ kind: "updated" } | Conflict> =>
  db.runTransaction(async (tx) => {
    const source = await tx.get(importSourceRef(db, input.ownerId, input.batchId, input.sourceId));
    if (!source.exists) return { kind: "batch_missing" }; const current = source.data()!;
    if (!same(input, current)) return { kind: "source_conflict" };
    if (current.state !== expected) return { kind: "state_conflict", expected, actual: current.state as ImportSourceState };
    const batch = importBatchRef(db, input.ownerId, input.batchId); const data = await tx.get(batch);
    if (!data.exists) return { kind: "batch_missing" }; const counts = data.data()!.counters as ImportBatchCounters;
    tx.update(batch, { counters: { ...counts, ...Object.fromEntries(Object.entries(delta).map(([key, value]) => [key, counts[key as keyof ImportBatchCounters] + value!])) }, updatedAt: FieldValue.serverTimestamp() });
    return { kind: "updated" };
  });
