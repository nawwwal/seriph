import { describe, expect, it, vi } from "vitest";
import { failPlanningTerminally } from "../../src/imports/planning/finalizePlan";

type Data = Record<string, any>;
class Ref {
  constructor(readonly path: string, private readonly db: Db) {}
  collection(name: string) { return new Collection(`${this.path}/${name}`, this.db); }
  async get() { return { exists: this.db.docs.has(this.path), data: () => this.db.docs.get(this.path) }; }
}
class Collection {
  constructor(readonly path: string, private readonly db: Db) {}
  doc(id: string) { return new Ref(`${this.path}/${id}`, this.db); }
  async get() { return { docs: [...this.db.docs.entries()].filter(([path]) => path.startsWith(`${this.path}/`)).map(([path, data]) => ({ id: path.split("/").at(-1), ref: new Ref(path, this.db), data: () => data })) }; }
}
class Tx {
  constructor(private readonly db: Db) {}
  get = (ref: Ref | Collection) => ref.get();
  update = (ref: Ref, data: Data) => this.db.docs.set(ref.path, { ...this.db.docs.get(ref.path), ...data });
}
class Db {
  docs = new Map<string, Data>();
  collection = (name: string) => new Collection(name, this);
  runTransaction = async <T>(fn: (tx: Tx) => Promise<T>) => fn(new Tx(this));
}

describe("finalize plan terminal failures", () => {
  it("fails affected font items and sources before queuing reconciliation", async () => {
    const db = new Db(); const batch = "users/owner-1/importBatches/batch-1";
    db.docs.set(batch, { outcome: "active", phases: { planning: { state: "building" } } });
    db.docs.set(`${batch}/items/font-1`, { role: "font", action: "apply", state: "classified", sourceId: "source-1" });
    db.docs.set(`${batch}/items/font-2`, { role: "font", action: "apply", state: "classified", sourceId: "source-2" });
    db.docs.set(`${batch}/sources/source-1`, { state: "discovered" });
    db.docs.set(`${batch}/sources/source-2`, { state: "discovered" });
    const enqueue = vi.fn().mockResolvedValue(undefined);
    await failPlanningTerminally(db as any, { kind: "finalize_plan", ownerId: "owner-1", batchId: "batch-1", resourceId: "batch-1" }, "source_object_missing", enqueue, { itemId: "font-1", sourceId: "source-1" });
    expect(db.docs.get(`${batch}/items/font-1`)).toMatchObject({ state: "failed", error: { code: "source_object_missing" } });
    expect(db.docs.get(`${batch}/sources/source-1`)).toMatchObject({ state: "failed", error: { code: "source_object_missing" } });
    expect(db.docs.get(`${batch}/items/font-2`)).toMatchObject({ state: "classified" });
    expect(db.docs.get(`${batch}/sources/source-2`)).toMatchObject({ state: "discovered" });
    expect(db.docs.get(batch)).toMatchObject({ phases: { planning: { state: "failed" } } });
    expect(enqueue).toHaveBeenCalledWith({ kind: "reconcile_batch", ownerId: "owner-1", batchId: "batch-1", resourceId: "batch-1" });
  });
});
