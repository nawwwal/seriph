import { describe, expect, it } from "vitest";
import { buildImportPlan } from "../../src/imports/planning/buildPlan";
import { validatePlan } from "../../src/imports/planning/validatePlan";
import { claimAsset, commitAssetClaim } from "../../src/imports/store/assetClaimStore";

type Data = Record<string, any>;
class Ref { constructor(readonly path: string, private readonly db: Db) {} collection(name: string) { return { doc: (id: string) => new Ref(`${this.path}/${name}/${id}`, this.db) }; } async get() { return { exists: this.db.docs.has(this.path), data: () => this.db.docs.get(this.path) }; } }
class Tx { constructor(private readonly db: Db) {} get = (ref: Ref) => ref.get(); set = (ref: Ref, data: Data) => this.db.docs.set(ref.path, data); update = (ref: Ref, data: Data) => this.db.docs.set(ref.path, { ...this.db.docs.get(ref.path), ...data }); }
class Db { docs = new Map<string, Data>(); collection = (name: string) => ({ doc: (id: string) => new Ref(`${name}/${id}`, this) }); runTransaction = async <T>(fn: (tx: Tx) => Promise<T>) => fn(new Tx(this)); }
const identity = (family = "Atlas") => ({ familyName: family, familyKey: family.toLowerCase(), familySlug: family.toLowerCase(), styleName: "Regular", weight: 400, width: 100, italic: false, logicalFaceKey: "regular|w-400|wdth-100|italic-no", containerFormat: "OTF" as const, technology: "OTF" as const, reasons: [] });
const item = (id: string, sha256: string, format = "OTF", extra: Data = {}) => ({ id, itemId: id, ownerId: "owner-1", batchId: "batch-1", sha256, detectedFormat: format, format, version: "1", identity: { ...identity(), containerFormat: format }, ...extra });
const sha = (value: string) => value.repeat(64).slice(0, 64);
const timestamp = (date: Date) => ({ seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0, toDate: () => date });

describe("Task 16 review regressions", () => {
  it("chooses one batch-wide primary and reviews cross-family byte references", () => {
    const primary = item("a-primary", sha("a"), "OTF", { familyId: "atlas" });
    const crossFamily = item("z-reference", primary.sha256, "OTF", { familyId: "bravo" });
    const plan = buildImportPlan([crossFamily, primary]);
    expect(plan.items.find((entry) => entry.id === primary.id)).toMatchObject({ action: "apply" });
    expect(plan.items.find((entry) => entry.id === crossFamily.id)).toMatchObject({ action: "review", reasonCode: "cross_family_duplicate", primaryItemId: primary.id });
    expect(plan.families.find((family) => family.familyId === "bravo")?.clean).toBe(false);
    expect(plan.families.find((family) => family.familyId === "bravo")?.faces[0]?.assets).toHaveLength(0);
  });
  it("handles Firestore Timestamp-like leases for busy, expiry takeover, and commit", async () => {
    const db = new Db(); const input = { ownerId: "owner-1", batchId: "batch-1", itemId: "item-1", familyId: "atlas", logicalFaceKey: "regular", assetId: "asset-1", sha256: sha("d") };
    db.docs.set(`users/${input.ownerId}/assetClaims/${input.sha256}`, { ...input, claimId: "other:item", status: "leased", leaseExpiresAt: timestamp(new Date("2026-07-18T01:00:00Z")) });
    await expect(claimAsset(db as any, input, new Date("2026-07-18T00:30:00Z"))).resolves.toMatchObject({ kind: "busy" });
    await expect(claimAsset(db as any, input, new Date("2026-07-18T02:00:00Z"))).resolves.toMatchObject({ kind: "claimed" });
    db.docs.set(`users/${input.ownerId}/assetClaims/${input.sha256}`, { ...input, claimId: "batch-1:item-1", status: "leased", leaseExpiresAt: timestamp(new Date("2026-07-18T03:00:00Z")) });
    await expect(commitAssetClaim(db as any, input, new Date("2026-07-18T02:30:00Z"))).resolves.toEqual({ kind: "committed" });
  });
  it("rejects duplicate IDs, bad duplicate references, family drift, and nested tampering", () => {
    const plan = buildImportPlan([item("a", sha("a")), item("z", sha("a"))]);
    expect(() => buildImportPlan([item("same", sha("a")), item("same", sha("b"), "OTF")])).toThrow("unique");
    const wrongPrimary = structuredClone(plan) as any; wrongPrimary.items.find((entry: any) => entry.id === "z").primaryItemId = "missing";
    expect(() => validatePlan(wrongPrimary)).toThrow("primary");
    const drifted = structuredClone(plan) as any; drifted.families[0].faces[0].assets[0].itemId = "z";
    expect(() => validatePlan(drifted)).toThrow("family");
    const tampered = structuredClone(plan) as any; tampered.contentHash = sha("f");
    expect(() => validatePlan(tampered)).toThrow("content hash");
    expect(Object.isFrozen(plan.families[0]!.faces[0]!.assets[0]!)).toBe(true);
  });
});
