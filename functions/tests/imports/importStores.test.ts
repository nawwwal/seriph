import { describe, expect, it } from "vitest";
import { createBatch } from "../../src/imports/store/batchStore";
import { importBatchRef, importSourceRef } from "../../src/imports/store/paths";
import { registerSource, transitionSource, updateBatchSummary } from "../../src/imports/store/sourceStore";

type Data = Record<string, unknown>;
class FakeRef {
  constructor(readonly path: string, private readonly db: FakeDb) {}
  collection(id: string) { return { doc: (key: string) => new FakeRef(`${this.path}/${id}/${key}`, this.db) }; }
  async get() { return { exists: this.db.docs.has(this.path), data: () => this.db.docs.get(this.path) }; }
}
class FakeTx {
  private wrote = false;
  constructor(private readonly db: FakeDb) {}
  get = (ref: FakeRef) => {
    if (this.wrote) throw new Error("transaction read after write");
    return ref.get();
  };
  set = (ref: FakeRef, data: Data) => { this.wrote = true; this.db.docs.set(ref.path, { ...data }); this.db.writes.push([ref.path, data]); };
  update = (ref: FakeRef, data: Data) => { this.wrote = true; this.db.docs.set(ref.path, { ...this.db.docs.get(ref.path), ...data }); this.db.writes.push([ref.path, data]); };
}
class FakeDb {
  docs = new Map<string, Data>(); writes: [string, Data][] = [];
  collection = (id: string) => ({ doc: (key: string) => new FakeRef(`${id}/${key}`, this) });
  runTransaction = async <T>(run: (tx: FakeTx) => Promise<T>) => run(new FakeTx(this));
}
const batch = { ownerId: "ada", batchId: "batch-1", label: "July", expectedSourceCount: 1 };
const source = { ...batch, sourceId: "source-1", originalPath: "/inbox/font.zip", filename: "font.zip", declaredSize: 3, declaredMimeType: "application/zip", storagePath: "imports/ada/font.zip" };

describe("import repositories", () => {
  it("builds owner-scoped batch and source paths", () => {
    const db = new FakeDb();
    expect(importBatchRef(db, "ada", "batch-1").path).toBe("users/ada/importBatches/batch-1");
    expect(importSourceRef(db, "ada", "batch-1", "source-1").path).toBe("users/ada/importBatches/batch-1/sources/source-1");
    expect(() => importBatchRef(db, "ada/bob", "batch-1")).toThrow("ownerId");
  });

  it("creates a batch with server timestamps and zeroed counters", async () => {
    const db = new FakeDb();
    await createBatch(db, batch);
    const written = db.docs.get("users/ada/importBatches/batch-1")!;
    expect(written).toMatchObject({ ...batch, outcome: "active", counters: { sources: 0, failures: 0 } });
    expect(written).not.toHaveProperty("registeredSourceCount");
    expect(written.createdAt).toBeDefined(); expect(written.updatedAt).toBeDefined();
  });

  it("registers one stable source and does not double-increment on retry", async () => {
    const db = new FakeDb(); await createBatch(db, batch);
    await registerSource(db, source); await registerSource(db, source);
    expect(db.writes.filter(([path]) => path.endsWith("/sources/source-1"))).toHaveLength(1);
    expect((db.docs.get("users/ada/importBatches/batch-1")!.counters as Data).sources).toBe(1);
  });

  it("returns conflicts for mismatched source identity and invalid transitions", async () => {
    const db = new FakeDb(); await createBatch(db, batch); await registerSource(db, source);
    await expect(registerSource(db, { ...source, filename: "other.zip" })).resolves.toEqual({ kind: "source_conflict" });
    await expect(transitionSource(db, source, "discovered", "uploading")).resolves.toEqual({ kind: "invalid_transition", from: "discovered", to: "uploading" });
  });

  it("updates summary counters only from the expected source state", async () => {
    const db = new FakeDb(); await createBatch(db, batch); await registerSource(db, source);
    await transitionSource(db, source, "registered", "uploading");
    await transitionSource(db, source, "uploading", "uploaded");
    await expect(updateBatchSummary(db, source, "uploaded", { discoveredItems: 2, warnings: 1 })).resolves.toEqual({ kind: "updated" });
    expect(db.docs.get("users/ada/importBatches/batch-1")!.counters).toMatchObject({ discoveredItems: 2, warnings: 1 });
    await expect(updateBatchSummary(db, source, "registered", { warnings: 1 })).resolves.toEqual({ kind: "state_conflict", expected: "registered", actual: "uploaded" });
  });
});
