import { describe, expect, it } from "vitest";
import { catalogFamilyDocId } from "../../src/storage/catalogIdentity";
import { parseBackfillEnrichmentArgs, runBackfillEnrichment } from "../../src/scripts/backfillEnrichmentJobs";

type Data = Record<string, any>;
class Snapshot { constructor(public readonly id: string, private readonly value: Data | undefined) {} get exists() { return this.value !== undefined; } data() { return this.value; } }
class Ref {
  readonly id: string;
  constructor(public readonly path: string, private readonly db: Db) { this.id = path.split("/").pop()!; }
  async get() { return new Snapshot(this.id, this.db.docs.get(this.path)); }
}
class Db {
  docs = new Map<string, Data>();
  collection(name: string) {
    const db = this;
    return {
      doc: (id: string) => new Ref(`${name}/${id}`, db),
      where: () => ({ limit: () => ({ get: async () => ({ size: db.familyDocs().length, docs: db.familyDocs() }) }), get: async () => ({ size: db.familyDocs().length, docs: db.familyDocs() }) }),
    };
  }
  runTransaction<T>(work: (tx: { get: (ref: Ref) => Promise<Snapshot>; set: (ref: Ref, value: Data, options?: { merge?: boolean }) => void }) => Promise<T>) {
    return work({
      get: (ref) => ref.get(),
      set: (ref, value, options) => {
        const next = options?.merge ? { ...(this.docs.get(ref.path) ?? {}) } : {};
        this.docs.set(ref.path, { ...next, ...value });
      },
    });
  }
  familyDocs() {
    return [...this.docs.entries()].filter(([path]) => path.startsWith("fontfamilies/")).map(([path, data]) => new Ref(path, this) as Ref & { data: () => Data }).map((ref) => Object.assign(ref, { data: () => this.docs.get(ref.path)! }));
  }
}

describe("enrichment backfill job integration", () => {
  it("defaults to dry-run and requires an owner", () => {
    expect(parseBackfillEnrichmentArgs(["--ownerId=owner-a"])).toEqual({ ownerId: "owner-a", apply: false });
    expect(() => parseBackfillEnrichmentArgs([])).toThrow("--ownerId is required");
  });

  it("queues only canonical active families and reports legacy ids", async () => {
    const db = new Db();
    db.docs.set(`fontfamilies/${catalogFamilyDocId("owner-a", "atlas")}`, { ownerId: "owner-a", slug: "atlas", version: 3, status: "ready", faces: [{}] });
    db.docs.set("fontfamilies/legacy-atlas", { ownerId: "owner-a", slug: "legacy-atlas", version: 1, status: "ready", faces: [{}] });
    const dry = await runBackfillEnrichment({ ownerId: "owner-a", apply: false }, db as never, new Date(100));
    expect(dry).toMatchObject({ scanned: 2, wouldQueue: 1, queued: 0, legacyIds: ["legacy-atlas"], apply: false });
    expect([...db.docs.keys()].filter((path) => path.startsWith("enrichmentJobs/"))).toHaveLength(0);

    const applied = await runBackfillEnrichment({ ownerId: "owner-a", apply: true }, db as never, new Date(100));
    expect(applied).toMatchObject({ wouldQueue: 1, queued: 1, requeued: 0, failed: [] });
    const job = [...db.docs.values()].find((value) => value.provenance?.kind === "backfill");
    expect(job).toMatchObject({ state: "queued", ownerId: "owner-a", familyId: "atlas", provenance: { source: "backfill-enrichment-jobs" } });
  });
});
