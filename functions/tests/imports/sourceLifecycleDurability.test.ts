import { expect, it, vi } from "vitest";
import { firestoreSourceLifecycleStore, type FinalizedObject } from "../../src/imports/reconcile/sourceFinalized";
import { firestoreSourceTimeoutStore, type TimeoutSource } from "../../src/imports/reconcile/sourceTimeout";

const object: FinalizedObject = { name: "intake/u1/b1/s1/font.otf", generation: "7", size: 150 * 1024 * 1024 + 1 };
const source = { ownerId: "u1", batchId: "b1", sourceId: "s1", storagePath: object.name, state: "uploading", declaredSize: 12 };

class FakeRef {
  constructor(readonly path: string, private readonly db: FakeDb) {}
  collection = (name: string) => ({ doc: (id: string) => new FakeRef(`${this.path}/${name}/${id}`, this.db) });
  get = async () => ({ exists: this.db.docs.has(this.path), data: () => this.db.docs.get(this.path) });
}
class FakeTx {
  constructor(private readonly db: FakeDb) {}
  get = (ref: FakeRef) => ref.get();
  update = (ref: FakeRef, data: Record<string, unknown>) => {
    this.db.history.push(data); this.db.docs.set(ref.path, { ...this.db.docs.get(ref.path), ...data });
  };
}
class FakeDb {
  docs = new Map<string, Record<string, unknown>>(); history: Record<string, unknown>[] = [];
  collection = (name: string) => ({ doc: (id: string) => new FakeRef(`${name}/${id}`, this) });
  runTransaction = async <T>(run: (tx: FakeTx) => Promise<T>) => run(new FakeTx(this));
}

class TimeoutRef {
  constructor(readonly path: string, private readonly db: TimeoutDb) {}
  collection = (name: string) => ({ doc: (id: string) => new TimeoutRef(`${this.path}/${name}/${id}`, this.db) });
  get = async () => ({ exists: this.db.docs.has(this.path), data: () => this.db.docs.get(this.path) });
}
class TimeoutTx {
  constructor(private readonly db: TimeoutDb) {}
  get = (ref: TimeoutRef) => ref.get();
  update = (ref: TimeoutRef, data: Record<string, unknown>) => {
    this.db.docs.set(ref.path, { ...this.db.docs.get(ref.path), ...data });
  };
}
class TimeoutDb {
  docs = new Map<string, Record<string, unknown>>();
  collection = (name: string) => ({ doc: (id: string) => new TimeoutRef(`${name}/${id}`, this) });
  doc = (path: string) => new TimeoutRef(path, this);
  runTransaction = async <T>(run: (tx: TimeoutTx) => Promise<T>) => run(new TimeoutTx(this));
}

it("keeps a finalized source dispatch pending until a redelivery enqueues it", async () => {
  const db = new FakeDb(); const path = "users/u1/importBatches/b1/sources/s1";
  db.docs.set(path, { ...source });
  const enqueue = vi.fn().mockRejectedValueOnce(new Error("queue unavailable")).mockResolvedValue("created");
  const store = firestoreSourceLifecycleStore({ db: db as never, enqueue });

  await expect(store.markUploadedAndEnqueue(source, object)).rejects.toThrow("queue unavailable");
  expect(db.docs.get(path)).toMatchObject({ state: "uploaded", pendingDispatch: { task: { kind: "discover_source", resourceId: "s1", sourceSize: object.size } } });
  await expect(store.markUploadedAndEnqueue(source, object)).resolves.toEqual({ kind: "already_confirmed", generation: "7" });
  expect(enqueue).toHaveBeenCalledTimes(2);
  expect(db.history.filter((write) => write.state === "uploaded")).toHaveLength(1);
  expect(db.docs.get(path)?.pendingDispatch).toBeNull();
});

it("persists timeout reconciliation until the Firestore dispatch succeeds", async () => {
  const db = new TimeoutDb();
  const sourcePath = "users/u1/importBatches/b1/sources/s1";
  const batchPath = "users/u1/importBatches/b1";
  db.docs.set(sourcePath, { state: "uploading", updatedAt: 100, committedFamilyCount: 0 });
  db.docs.set(batchPath, { state: "uploading" });
  const enqueue = vi.fn().mockRejectedValueOnce(new Error("queue unavailable")).mockResolvedValue("created");
  const store = firestoreSourceTimeoutStore({ db: db as never, enqueue });
  const source: TimeoutSource = {
    ownerId: "u1", batchId: "b1", sourceId: "s1", state: "uploading", updatedAt: 100,
    documentPath: sourcePath, staleBefore: 200,
  };

  await expect(store.markTimedOut(source)).resolves.toBe(true);
  const pending = db.docs.get(batchPath)?.pendingDispatch;
  expect(pending).toMatchObject({ token: "reconcile:b1", task: { kind: "reconcile_batch", resourceId: "b1" } });
  const dispatchReconcile = store.dispatchReconcile!;
  const batch = { ownerId: "u1", batchId: "b1", documentPath: batchPath, pendingDispatch: pending as never };

  await expect(dispatchReconcile(batch)).rejects.toThrow("queue unavailable");
  expect(db.docs.get(batchPath)?.pendingDispatch).toEqual(pending);
  await expect(dispatchReconcile(batch)).resolves.toBeUndefined();
  expect(db.docs.get(batchPath)?.pendingDispatch).toBeNull();
  expect(enqueue).toHaveBeenCalledTimes(2);
});
