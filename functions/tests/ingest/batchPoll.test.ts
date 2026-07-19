import { beforeEach, describe, expect, it, vi } from "vitest";

const firestore = vi.hoisted(() => ({ db: undefined as FakeDb | undefined }));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => firestore.db,
  FieldValue: { delete: () => "deleted", serverTimestamp: () => "timestamp" },
}));

type Data = Record<string, unknown>;

class FakeRef {
  constructor(readonly path: string, private readonly db: FakeDb) {}
  async get() {
    const data = this.db.docs.get(this.path);
    return { exists: Boolean(data), data: () => data, ref: this };
  }
}

class FakeQuery {
  constructor(private readonly db: FakeDb) {}
  where() { return this; }
  async get() {
    const ref = this.db.ref("enrichmentJobs/job-a");
    const data = { ...this.db.docs.get(ref.path) };
    return { docs: [{ ref, data: () => data }] };
  }
}

class FakeDb {
  readonly docs = new Map<string, Data>();
  beforeTransaction?: () => void;
  ref(path: string) { return new FakeRef(path, this); }
  collection = (name: string) => ({ doc: (id: string) => this.ref(`${name}/${id}`), where: () => new FakeQuery(this) });
  runTransaction = async (work: (tx: { get: (ref: FakeRef) => Promise<unknown>; set: (ref: FakeRef, data: Data, options?: { merge?: boolean }) => void }) => Promise<void>) => {
    this.beforeTransaction?.();
    await work({
      get: (ref) => ref.get(),
      set: (ref, data, options) => this.docs.set(ref.path, options?.merge ? { ...this.docs.get(ref.path), ...data } : data),
    });
  };
}

describe("enrichment lease watchdog", () => {
  beforeEach(() => {
    firestore.db = new FakeDb();
    firestore.db.docs.set("enrichmentJobs/job-a", {
      state: "submitted", attempt: 0, providerRunId: "run-a", leaseExpiresAt: new Date(1),
    });
  });

  it("does not reclaim a lease whose state changed after the query", async () => {
    const db = firestore.db!;
    db.beforeTransaction = () => db.docs.set("enrichmentJobs/job-a", { state: "complete", leaseExpiresAt: new Date(1) });
    const { watchExpiredEnrichmentLeases } = await import("../../src/ingest/batch/poll");

    await expect(watchExpiredEnrichmentLeases(new Date(2))).resolves.toBe(0);
    expect(db.docs.get("enrichmentJobs/job-a")).toMatchObject({ state: "complete" });
  });

  it("reclaims the same expired lease transactionally", async () => {
    const db = firestore.db!;
    const { watchExpiredEnrichmentLeases } = await import("../../src/ingest/batch/poll");

    await expect(watchExpiredEnrichmentLeases(new Date(2))).resolves.toBe(1);
    expect(db.docs.get("enrichmentJobs/job-a")).toMatchObject({ state: "retrying", failureCode: "lease_expired" });
    expect(db.docs.get("batchJobs/run-a")).toMatchObject({ reconciliationRequestedAt: "timestamp" });
  });
});
