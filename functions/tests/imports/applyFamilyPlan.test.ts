import { describe, expect, it } from "vitest";
import { applyFamilyPlan, type ApplyFamilyPlanInput } from "../../src/imports/apply/applyFamilyPlan";

type Data = Record<string, any>;
class Ref {
  constructor(readonly path: string, private readonly db: Db) {}
  collection(name: string) { return { doc: (id: string) => new Ref(`${this.path}/${name}/${id}`, this.db) }; }
  async get() { return { exists: this.db.docs.has(this.path), data: () => this.db.docs.get(this.path) }; }
}
class Tx {
  constructor(private readonly db: Db) {}
  get = (ref: Ref) => ref.get();
  set = (ref: Ref, data: Data) => { this.db.docs.set(ref.path, { ...data }); this.db.writes.push([ref.path, data]); };
  update = (ref: Ref, data: Data) => { this.db.docs.set(ref.path, { ...this.db.docs.get(ref.path), ...data }); this.db.writes.push([ref.path, data]); };
}
class Db {
  docs = new Map<string, Data>(); writes: [string, Data][] = [];
  collection = (name: string) => ({ doc: (id: string) => new Ref(`${name}/${id}`, this) });
  runTransaction = async <T>(fn: (tx: Tx) => Promise<T>) => fn(new Tx(this));
}
const sha = "a".repeat(64);
const plan = { ownerId: "owner-1", batchId: "batch-1", planVersion: 2, state: "validated" as const,
  items: [{ id: "item-1", itemId: "item-1", sha256: sha, action: "apply" as const, reasonCode: "planned", reasonCodes: [], familyId: "atlas", logicalFaceKey: "regular" }],
  families: [{ familyId: "atlas", familyName: "Atlas", familySlug: "atlas", clean: true,
    faces: [{ logicalFaceKey: "regular", styleName: "Regular", weight: 400, width: 100, italic: false, assets: [{ assetId: "asset-1", itemId: "item-1", sha256: sha, format: "OTF", version: "1" }] }] }], reviewItems: [] };
const input = (expectedVersion = 3): ApplyFamilyPlanInput => ({ plan, familyId: "atlas", expectedVersion,
  claims: [{ ownerId: "owner-1", batchId: "batch-1", itemId: "item-1", sha256: sha, familyId: "atlas", logicalFaceKey: "regular", assetId: "asset-1", bytes: Buffer.from("font") }] });
const seedClaim = (db: Db) => db.docs.set(`users/owner-1/assetClaims/${sha}`, { ...input().claims[0], claimId: "batch-1:item-1", status: "leased" });
const deps = (db: Db) => ({ db: db as any, write: async () => undefined, enqueueEnrichment: async () => undefined });

describe("applyFamilyPlan", () => {
  it("writes all faces in one family commit and returns the same mutation on redelivery", async () => {
    const db = new Db(); seedClaim(db); db.docs.set("fontfamilies/owner-1__atlas", { id: "owner-1__atlas", slug: "atlas", name: "Atlas", faces: [], version: 3, status: "ready" });
    const first = await applyFamilyPlan(input(), deps(db));
    const second = await applyFamilyPlan(input(), deps(db));
    expect(first).toMatchObject({ kind: "applied", familyVersion: 4 });
    expect(second).toMatchObject({ kind: "already_applied", familyVersion: 4 });
    expect(db.writes.filter(([path]) => path.startsWith("fontfamilies/")).length).toBe(1);
    expect(db.docs.get(`users/owner-1/assetClaims/${sha}`)).toMatchObject({ status: "committed" });
    expect([...db.docs.keys()].some((path) => path.includes("enrichmentJobs"))).toBe(true);
  });

  it("requires replanning when the catalogue version changed", async () => {
    const db = new Db(); seedClaim(db); db.docs.set("fontfamilies/owner-1__atlas", { version: 4, faces: [] });
    await expect(applyFamilyPlan(input(), deps(db))).resolves.toEqual({ kind: "replan_required", expectedVersion: 3, actualVersion: 4 });
  });

  it("does not publish a partial family when the transaction fails", async () => {
    const db = new Db(); seedClaim(db); db.docs.set("fontfamilies/owner-1__atlas", { version: 3, faces: [] });
    const failing = { ...deps(db), commitFamilyMutation: async () => { throw new Error("transaction failed"); } };
    await expect(applyFamilyPlan(input(), failing)).resolves.toMatchObject({ kind: "failed", retryable: true });
    expect(db.writes.filter(([path]) => path.startsWith("fontfamilies/")).length).toBe(0);
  });
});
