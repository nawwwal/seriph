import { describe, expect, it, vi } from "vitest";
import { buildImportPlan } from "../../src/imports/planning/buildPlan";
import { validatePlan } from "../../src/imports/planning/validatePlan";
import { claimAsset, commitAssetClaim } from "../../src/imports/store/assetClaimStore";
import { enqueuePendingPlanTasks, saveValidatedPlan } from "../../src/imports/store/planStore";

type Data = Record<string, any>;
class Ref {
  constructor(readonly path: string, private readonly db: Db) {}
  collection(name: string) { return { doc: (id: string) => new Ref(`${this.path}/${name}/${id}`, this.db) }; }
  async get() { return { exists: this.db.docs.has(this.path), data: () => this.db.docs.get(this.path) }; }
}
class Tx {
  constructor(private readonly db: Db) {}
  get = (ref: Ref) => ref.get();
  set = (ref: Ref, data: Data) => this.db.docs.set(ref.path, data);
  update = (ref: Ref, data: Data) => this.db.docs.set(ref.path, { ...this.db.docs.get(ref.path), ...data });
}
class Db {
  docs = new Map<string, Data>();
  collection = (name: string) => ({ doc: (id: string) => new Ref(`${name}/${id}`, this) });
  runTransaction = async <T>(fn: (tx: Tx) => Promise<T>) => fn(new Tx(this));
}

const identity = (family = "Atlas", face = "regular|w-400|wdth-100|italic-no") => ({
  familyName: family, familyKey: family.toLowerCase(), familySlug: family.toLowerCase(), styleName: "Regular",
  weight: 400, width: 100, italic: false, logicalFaceKey: face, containerFormat: "OTF" as const,
  technology: "OTF" as const, reasons: [],
});
const item = (id: string, sha256: string, format: string, version: string, extra: Data = {}) => ({
  id, itemId: id, ownerId: "owner-1", batchId: "batch-1", sha256, detectedFormat: format,
  format, version, identity: { ...identity(), containerFormat: format }, ...extra,
});
const sha = (value: string) => value.repeat(64).slice(0, 64);

describe("immutable import plans", () => {
  it("keeps formats and versions while selecting the smallest exact-byte primary", () => {
    const otfV1 = item("a-otf-v1", sha("a"), "OTF", "1");
    const woff2V1 = item("c-woff2-v1", sha("b"), "WOFF2", "1");
    const otfV2 = item("d-otf-v2", sha("c"), "OTF", "2");
    const duplicateOtfV1 = item("z-duplicate", otfV1.sha256, "OTF", "1");
    const plan = buildImportPlan([otfV1, woff2V1, otfV2, duplicateOtfV1]);
    expect(plan.families[0].faces[0].assets).toHaveLength(3);
    expect(plan.items.find((entry) => entry.id === duplicateOtfV1.id)?.action).toBe("duplicate");
    expect(plan.items.find((entry) => entry.id === otfV1.id)?.action).toBe("apply");
    expect(plan.items.find((entry) => entry.id === duplicateOtfV1.id)?.primaryItemId).toBe(otfV1.id);
  });

  it("is deterministic and turns same-format/version byte conflicts into review", () => {
    const first = item("z", sha("a"), "OTF", "1");
    const second = item("y", sha("b"), "OTF", "1");
    const a = buildImportPlan([first, second]);
    const b = buildImportPlan([second, first]);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.items.every((entry) => entry.action === "review")).toBe(true);
    expect(a.reviewItems.map((entry) => entry.reasonCode)).toContain("same_format_version_conflict");
  });

  it("reviews EOT, invalid SHA claims, and case-insensitive destinations", () => {
    const plan = buildImportPlan([
      item("eot", sha("a"), "EOT", "1"),
      item("bad-hash", "not-a-sha", "OTF", "1"),
      item("dest-a", sha("b"), "OTF", "2", { destination: "Fonts/Atlas/Regular.otf" }),
      item("dest-b", sha("c"), "WOFF2", "2", { destination: "fonts/atlas/regular.OTF" }),
    ]);
    expect(plan.items.find((entry) => entry.id === "eot")?.action).toBe("review");
    expect(plan.items.find((entry) => entry.id === "bad-hash")?.action).toBe("review");
    expect(plan.reviewItems.map((entry) => entry.reasonCode)).toEqual(expect.arrayContaining([
      "eot_unsupported", "invalid_sha256", "destination_collision",
    ]));
  });

  it("claims only exact SHA-256 values and converges redelivery", async () => {
    const db = new Db();
    const input = { ownerId: "owner-1", batchId: "batch-1", itemId: "item-1", familyId: "atlas", logicalFaceKey: "regular", assetId: "asset-1", sha256: sha("a") };
    await expect(claimAsset(db as any, input, new Date("2026-07-18T00:00:00Z"))).resolves.toMatchObject({ kind: "claimed" });
    await expect(claimAsset(db as any, input, new Date("2026-07-18T00:01:00Z"))).resolves.toMatchObject({ kind: "claimed" });
    await expect(commitAssetClaim(db as any, input, new Date("2026-07-18T00:02:00Z"))).resolves.toMatchObject({ kind: "committed" });
    await expect(claimAsset(db as any, { ...input, itemId: "item-2" }, new Date("2026-07-18T00:03:00Z"))).resolves.toMatchObject({ kind: "committed_duplicate" });
    await expect(claimAsset(db as any, { ...input, sha256: "short" }, new Date())).rejects.toThrow("sha256");
  });

  it("increments the plan version transactionally and persists apply outbox records", async () => {
    const db = new Db();
    db.docs.set("users/owner-1/importBatches/batch-1", { planVersion: 1, phases: { planning: { state: "validated" } } });
    const plan = buildImportPlan([item("a", sha("a"), "OTF", "1")]);
    const enqueue = vi.fn().mockRejectedValueOnce(new Error("cloud tasks offline")).mockResolvedValue("created");
    const result = await saveValidatedPlan(db as any, { ...plan, planVersion: 1 }, { enqueue });
    expect(result).toMatchObject({ kind: "created", planVersion: 2 });
    const firstPayload = enqueue.mock.calls[0]?.[0];
    expect(firstPayload).toEqual(expect.objectContaining({ kind: "apply_family", planVersion: 2 }));
    expect([...db.docs.keys()].some((key) => key.includes("plans/2"))).toBe(true);
    const outboxPath = [...db.docs.keys()].find((key) => key.includes("applyTasks"))!;
    expect(db.docs.get(outboxPath)).toMatchObject({ status: "pending", attempts: 1, taskName: expect.any(String) });
    await expect(enqueuePendingPlanTasks(db as any, result.plan, { enqueue })).resolves.toMatchObject({ pending: 0, enqueued: 1 });
    expect(db.docs.get(outboxPath)).toMatchObject({ status: "enqueued", attempts: 2, payload: firstPayload });
    expect(Object.isFrozen(result.plan)).toBe(true);
    const changed = buildImportPlan([item("b", sha("b"), "OTF", "2")]);
    expect(await saveValidatedPlan(db as any, { ...changed, planVersion: 1 }, { enqueue })).toMatchObject({ planVersion: 3 });
    expect(validatePlan(result.plan).contentHash).toBe(result.plan.contentHash);
  });

});
