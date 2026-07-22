import { describe, expect, it, vi } from "vitest";
import {
  confirmFinalizedSource,
  type FinalizedObject,
  type SourceLifecycleStore,
} from "../../src/imports/reconcile/sourceFinalized";
import {
  expireSources,
  type SourceTimeoutStore,
  type TimeoutSource,
} from "../../src/imports/reconcile/sourceTimeout";
import { getImportConfig } from "../../src/imports/config/importConfig";

const object: FinalizedObject = { name: "intake/u1/b1/s1/font.otf", generation: "7", size: 12 };
const source = { ownerId: "u1", batchId: "b1", sourceId: "s1", storagePath: object.name, state: "uploading" as const };

function finalizationStore(found = source): SourceLifecycleStore & { marked: FinalizedObject[] } {
  const marked: FinalizedObject[] = [];
  return { marked, load: async () => found, markUploadedAndEnqueue: async (_source, uploaded) => {
    marked.push(uploaded); return { kind: "uploaded", generation: uploaded.generation };
  } };
}

it("rejects a finalized object whose path differs from its registered source", async () => {
  const store = finalizationStore({ ...source, storagePath: "intake/u1/b1/s1/other.otf" });
  await expect(confirmFinalizedSource(object, store)).resolves.toEqual({ kind: "rejected", code: "path_mismatch" });
});

it("marks a matching object uploaded and passes its generation to the enqueue boundary", async () => {
  const store = finalizationStore();
  await expect(confirmFinalizedSource(object, store)).resolves.toEqual({ kind: "uploaded", generation: "7" });
  expect(store.marked).toEqual([object]);
});

it("does not enqueue a repeated finalization generation", async () => {
  const store = finalizationStore();
  store.markUploadedAndEnqueue = async (_source, uploaded) => ({ kind: "already_confirmed", generation: uploaded.generation });
  await expect(confirmFinalizedSource(object, store)).resolves.toEqual({ kind: "already_confirmed", generation: "7" });
});

it("ignores objects outside the registered intake path", async () => {
  const store = finalizationStore();
  await expect(confirmFinalizedSource({ ...object, name: "unprocessed/font.otf" }, store)).resolves.toEqual({ kind: "ignored" });
});

const stale: TimeoutSource = { ownerId: "u1", batchId: "b1", sourceId: "s1", state: "uploading", updatedAt: 0 };

it("times out stale upload sources and reconciles each batch once", async () => {
  const timedOut: TimeoutSource[] = [];
  const queued: string[] = [];
  const store: SourceTimeoutStore = {
    listStale: async () => [stale, { ...stale, sourceId: "s2" }, { ...stale, state: "uploaded", sourceId: "s3" }, { ...stale, committedFamilyCount: 1, sourceId: "s4" }],
    markTimedOut: async (candidate) => { timedOut.push(candidate); return true; },
    enqueueReconcile: async (batch) => { queued.push(`${batch.ownerId}/${batch.batchId}`); return "created"; },
  };
  await expect(expireSources(store, { now: () => 1_440 * 60_000 + 1 })).resolves.toEqual({ timedOut: 2, batchesQueued: 1 });
  expect(timedOut.map(({ sourceId }) => sourceId)).toEqual(["s1", "s2"]);
  expect(queued).toEqual(["u1/b1"]);
});

it.each(["uploaded", "discovering", "discovered", "failed", "canceled", "timed_out"])(
  "ignores %s sources during timeout",
  async (state) => {
    const markTimedOut = vi.fn(async () => true);
    const store: SourceTimeoutStore = {
      listStale: async () => [{ ...stale, state }],
      markTimedOut,
      enqueueReconcile: async () => "created",
    };

    await expect(expireSources(store, { now: () => 1_440 * 60_000 + 1 })).resolves.toEqual({
      timedOut: 0,
      batchesQueued: 0,
    });
    expect(markTimedOut).not.toHaveBeenCalled();
  },
);

it("retries a persisted reconciliation dispatch after its first enqueue fails", async () => {
  let pending = false; let recoverable = false;
  const batch = { ownerId: "u1", batchId: "b1", pendingDispatch: {
    token: "reconcile:b1", task: { kind: "reconcile_batch" as const, ownerId: "u1", batchId: "b1", resourceId: "b1" },
  } };
  const store = {
    listStale: async () => pending ? [] : [stale],
    listPendingBatches: async () => recoverable ? [batch] : [],
    markTimedOut: async () => { pending = true; return true; },
    enqueueReconcile: async () => { recoverable = true; throw new Error("queue unavailable"); },
    dispatchReconcile: async () => { pending = false; return "created"; },
  } as SourceTimeoutStore & { listPendingBatches: () => Promise<Array<typeof batch>>; dispatchReconcile: () => Promise<string> };

  await expect(expireSources(store, { now: () => 1_440 * 60_000 + 1 })).rejects.toThrow("queue unavailable");
  await expect(expireSources(store, { now: () => 1_440 * 60_000 + 1 })).resolves.toEqual({ timedOut: 0, batchesQueued: 1 });
});

it("redelivers a stale active batch handoff idempotently", async () => {
  const batch = { ownerId: "u1", batchId: "b1" };
  const pending = { token: "recovery:discover_source:s1", task: { kind: "discover_source" as const, ownerId: "u1", batchId: "b1", resourceId: "s1" } };
  let recovered = false; let staleCutoff = 0; const dispatched: string[] = [];
  const store: SourceTimeoutStore = {
    listStale: async () => [], markTimedOut: async () => false, enqueueReconcile: async () => "created",
    listStaleBatches: async (cutoff) => { staleCutoff = cutoff; return recovered ? [] : [batch]; },
    recoverStaleBatch: async (candidate) => { candidate.pendingDispatch = pending; recovered = true; return true; },
    dispatchReconcile: async (candidate) => { dispatched.push(candidate.pendingDispatch!.token); return "created"; },
  };
  await expect(expireSources(store, { now: () => 1_440 * 60_000 + 1 })).resolves.toEqual({ timedOut: 0, batchesQueued: 1 });
  expect(staleCutoff).toBe((1_440 - 15) * 60_000 + 1);
  expect(dispatched).toEqual([pending.token]);
});

it("uses the bounded Remote Config timeout when expiring sources", async () => {
  let cutoff = 0;
  const store: SourceTimeoutStore = {
    listStale: async (value) => { cutoff = value; return []; },
    markTimedOut: async () => false,
    enqueueReconcile: async () => "created",
  };

  await expireSources(store, { now: () => 300_000 }, getImportConfig(() => "2").sourceTimeoutMinutes);

  expect(cutoff).toBe(180_000);
});
