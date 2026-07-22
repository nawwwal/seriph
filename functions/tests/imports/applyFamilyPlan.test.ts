import { createHash } from "crypto";
import { describe, expect, it } from "vitest";
import { applyFamilyPlan, applyFamilyTask, type ApplyFamilyPlanInput } from "../../src/imports/apply/applyFamilyPlan";

type Data = Record<string, any>;
class Ref {
  constructor(readonly path: string, private readonly db: Db) {}
  collection(name: string) { return { doc: (id: string) => new Ref(`${this.path}/${name}/${id}`, this.db) }; }
  async get() { return { exists: this.db.docs.has(this.path), data: () => this.db.docs.get(this.path) }; }
}
class Tx {
  writes: [string, Data][] = [];
  constructor(private readonly db: Db) {}
  get = (ref: Ref) => ref.get();
  set = (ref: Ref, data: Data) => { this.db.docs.set(ref.path, { ...data }); this.writes.push([ref.path, data]); this.db.writes.push([ref.path, data]); };
  update = (ref: Ref, data: Data) => { this.db.docs.set(ref.path, { ...this.db.docs.get(ref.path), ...data }); this.writes.push([ref.path, data]); this.db.writes.push([ref.path, data]); };
}
class Db {
  docs = new Map<string, Data>(); writes: [string, Data][] = []; transactionWrites: [string, Data][][] = [];
  collection = (name: string) => ({ doc: (id: string) => new Ref(`${name}/${id}`, this) });
  runTransaction = async <T>(fn: (tx: Tx) => Promise<T>) => { const tx = new Tx(this); const result = await fn(tx); this.transactionWrites.push(tx.writes); return result; };
}
const fontBytes = Buffer.from("verified font");
const sha = createHash("sha256").update(fontBytes).digest("hex");
const plan = { ownerId: "owner-1", batchId: "batch-1", planVersion: 2, state: "validated" as const,
  items: [{ id: "item-1", itemId: "item-1", sha256: sha, action: "apply" as const, reasonCode: "planned", reasonCodes: [], familyId: "atlas", logicalFaceKey: "regular" }],
  families: [{ familyId: "atlas", familyName: "Atlas", familySlug: "atlas", clean: true,
    faces: [{ logicalFaceKey: "regular", styleName: "Regular", weight: 400, width: 100, italic: false, assets: [{ assetId: "asset-1", itemId: "item-1", sha256: sha, format: "OTF", version: "1" }] }] }], reviewItems: [] };
const input = (expectedVersion = 3): ApplyFamilyPlanInput => ({ plan, familyId: "atlas", expectedVersion,
  claims: [{ ownerId: "owner-1", batchId: "batch-1", itemId: "item-1", sha256: sha, familyId: "atlas", logicalFaceKey: "regular", assetId: "asset-1", bytes: fontBytes }] });
const seedClaim = (db: Db, leaseExpiresAt = new Date("2030-01-01")) => db.docs.set(`users/owner-1/assetClaims/${sha}`, { ...input().claims[0], claimId: "batch-1:item-1", status: "leased", leaseExpiresAt });
const deps = (db: Db) => ({ db: db as any, write: async () => undefined, enqueueEnrichment: async () => undefined });

describe("applyFamilyPlan", () => {
  it("writes all faces in one family commit and returns the same mutation on redelivery", async () => {
    const db = new Db(); seedClaim(db); db.docs.set("fontfamilies/owner-1__atlas", { id: "owner-1__atlas", slug: "atlas", name: "Atlas", faces: [], version: 3, status: "ready" });
    const requests: unknown[] = []; const runtime = { ...deps(db), enqueueEnrichment: async (request: unknown) => { requests.push(request); } };
    const first = await applyFamilyPlan(input(), runtime);
    const second = await applyFamilyPlan(input(), runtime);
    expect(first).toMatchObject({ kind: "applied", familyVersion: 4 });
    expect(second).toMatchObject({ kind: "already_applied", familyVersion: 4 });
    expect(db.writes.filter(([path]) => path.startsWith("fontfamilies/")).length).toBe(1);
    expect(db.docs.get(`users/owner-1/assetClaims/${sha}`)).toMatchObject({ status: "committed" });
    expect(db.docs.get(`users/owner-1/assetClaims/${sha}`)).not.toHaveProperty("bytes");
    expect(requests).toHaveLength(2);
    const jobPath = `enrichmentJobs/${(requests[0] as { jobId: string }).jobId}`;
    expect(db.docs.get(jobPath)).toMatchObject({ familyId: "atlas", familyVersion: 4, state: "queued" });
    expect(db.writes.filter(([path]) => path === jobPath)).toHaveLength(1);
    expect(db.transactionWrites[0]?.map(([path]) => path)).toContain(jobPath);
    expect(db.transactionWrites[0]?.map(([path]) => path)).toContain("fontfamilies/owner-1__atlas");
  });

  it("requires replanning when the catalogue version changed", async () => {
    const db = new Db(); seedClaim(db); db.docs.set("fontfamilies/owner-1__atlas", { version: 4, faces: [] });
    await expect(applyFamilyPlan(input(), deps(db))).resolves.toEqual({ kind: "replan_required", expectedVersion: 3, actualVersion: 4 });
    expect(db.docs.get("users/owner-1/importBatches/batch-1/plans/2/applyTasks/atlas")).toMatchObject({ status: "replan_required" });
    expect(db.docs.get("users/owner-1/importBatches/batch-1/plans/2")).toMatchObject({ state: "partial" });
  });

  it("does not publish a partial family when the transaction fails", async () => {
    const db = new Db(); seedClaim(db); db.docs.set("fontfamilies/owner-1__atlas", { version: 3, faces: [] });
    const failing = { ...deps(db), commitFamilyMutation: async () => { throw new Error("transaction failed"); } };
    await expect(applyFamilyPlan(input(), failing)).resolves.toMatchObject({ kind: "failed", retryable: true });
    expect(db.writes.filter(([path]) => path.startsWith("fontfamilies/")).length).toBe(0);
  });

  it("rejects expired leases before publishing a family", async () => {
    const db = new Db(); seedClaim(db, new Date("2020-01-01")); db.docs.set("fontfamilies/owner-1__atlas", { version: 3, faces: [] });
    await expect(applyFamilyPlan(input(), deps(db))).resolves.toMatchObject({ kind: "failed", retryable: true });
    expect(db.writes.filter(([path]) => path.startsWith("fontfamilies/")).length).toBe(0);
  });

  it("does not commit a catalogue mutation after cancellation wins the final transaction", async () => {
    const db = new Db(); seedClaim(db); db.docs.set("fontfamilies/owner-1__atlas", { version: 3, faces: [] });
    db.docs.set("users/owner-1/importBatches/batch-1", { outcome: "canceled" });
    await expect(applyFamilyPlan(input(), deps(db))).resolves.toEqual({ kind: "failed", retryable: false, errorCode: "batch_canceled" });
    expect(db.writes.filter(([path]) => path.startsWith("fontfamilies/")).length).toBe(0);
  });

  it("requires the persisted pre-apply version instead of reading the current family", async () => {
    const db = new Db(); db.docs.set("users/owner-1/importBatches/batch-1/plans/2", plan); db.docs.set("fontfamilies/owner-1__atlas", { version: 3, faces: [] });
    const result = await applyFamilyTask({ kind: "apply_family", ownerId: "owner-1", batchId: "batch-1", resourceId: "atlas", planVersion: 2 }, { db: db as any, sourceBucket: {} as any, enqueueEnrichment: async () => undefined });
    expect(result).toEqual({ kind: "review", reasonCode: "expected_version_missing" });
    expect(db.docs.get("users/owner-1/importBatches/batch-1/plans/2/applyTasks/atlas")).toMatchObject({ status: "review" });
  });
});
