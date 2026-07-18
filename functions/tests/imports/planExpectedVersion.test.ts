import { describe, expect, it } from "vitest";
import { saveValidatedPlan } from "../../src/imports/store/planStore";

type Data = Record<string, any>;
class Ref {
  constructor(readonly path: string, private readonly db: Db) {}
  collection(name: string) { return { doc: (id: string) => new Ref(`${this.path}/${name}/${id}`, this.db) }; }
  async get() { return { exists: this.db.docs.has(this.path), data: () => this.db.docs.get(this.path) }; }
}
class Tx {
  constructor(private readonly db: Db) {}
  get = (ref: Ref) => ref.get();
  set = (ref: Ref, data: Data) => this.db.docs.set(ref.path, { ...data });
  update = (ref: Ref, data: Data) => this.db.docs.set(ref.path, { ...this.db.docs.get(ref.path), ...data });
}
class Db {
  docs = new Map<string, Data>();
  collection = (name: string) => ({ doc: (id: string) => new Ref(`${name}/${id}`, this) });
  runTransaction = async <T>(run: (tx: Tx) => Promise<T>) => run(new Tx(this));
}
const sha = "a".repeat(64);
const plan = { ownerId: "ada", batchId: "batch", planVersion: 1, state: "validated" as const, reviewItems: [],
  items: [{ id: "item", itemId: "item", sha256: sha, action: "apply" as const, reasonCode: "planned", reasonCodes: [], familyId: "atlas", logicalFaceKey: "regular" }],
  families: [{ familyId: "atlas", familyName: "Atlas", familySlug: "atlas", clean: true, faces: [{ logicalFaceKey: "regular", styleName: "Regular", weight: 400, width: 100, italic: false, assets: [{ assetId: "asset", itemId: "item", sha256: sha, format: "OTF", version: "1" }] }] }] };

describe("saveValidatedPlan", () => {
  it("persists the catalogue version captured before each apply task is queued", async () => {
    const db = new Db(); db.docs.set("users/ada/importBatches/batch", { planVersion: 1, phases: {} });
    db.docs.set("fontfamilies/ada__atlas", { version: 7 });
    await saveValidatedPlan(db as any, plan, { enqueue: async () => undefined });
    expect(db.docs.get("users/ada/importBatches/batch/plans/2")).toMatchObject({ expectedFamilyVersions: { atlas: 7 } });
    expect(db.docs.get("users/ada/importBatches/batch/plans/2/applyTasks/atlas")).toMatchObject({ expectedFamilyVersion: 7 });
  });
});
