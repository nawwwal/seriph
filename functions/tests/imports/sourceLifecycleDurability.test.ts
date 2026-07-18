import { expect, it, vi } from "vitest";
import { firestoreSourceLifecycleStore, type FinalizedObject } from "../../src/imports/reconcile/sourceFinalized";

const object: FinalizedObject = { name: "intake/u1/b1/s1/font.otf", generation: "7", size: 12 };
const source = { ownerId: "u1", batchId: "b1", sourceId: "s1", storagePath: object.name, state: "uploading" };

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

it("keeps a finalized source dispatch pending until a redelivery enqueues it", async () => {
  const db = new FakeDb(); const path = "users/u1/importBatches/b1/sources/s1";
  db.docs.set(path, { ...source });
  const enqueue = vi.fn().mockRejectedValueOnce(new Error("queue unavailable")).mockResolvedValue("created");
  const store = firestoreSourceLifecycleStore({ db: db as never, enqueue });

  await expect(store.markUploadedAndEnqueue(source, object)).rejects.toThrow("queue unavailable");
  expect(db.docs.get(path)).toMatchObject({ state: "uploaded", pendingDispatch: { task: { kind: "discover_source", resourceId: "s1" } } });
  await expect(store.markUploadedAndEnqueue(source, object)).resolves.toEqual({ kind: "already_confirmed", generation: "7" });
  expect(enqueue).toHaveBeenCalledTimes(2);
  expect(db.history.filter((write) => write.state === "uploaded")).toHaveLength(1);
  expect(db.docs.get(path)?.pendingDispatch).toBeNull();
});
