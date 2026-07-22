import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildBatchCatalogKey } from "../../src/ingest/batch/key";
import { applyOutputRow } from "../../src/ingest/batch/output";

const firestore = vi.hoisted(() => ({ db: undefined as FakeDb | undefined }));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => firestore.db,
  FieldValue: { delete: () => "deleted", serverTimestamp: () => "timestamp" },
}));

vi.mock("../../src/ai/enrichFont", () => ({
  CATALOG_KEY_PREFIX: "Catalog-Key:",
  parseAnalysis: () => ({ summary: "enriched" }),
  buildEnrichmentUpdate: async () => ({ enrichment: { summary: "enriched" }, status: "ready" }),
}));

type Data = Record<string, unknown>;

class FakeRef {
  constructor(readonly path: string, private readonly db: FakeDb) {}
  get id() { return this.path.split("/").pop() ?? ""; }
  get ref() { return this; }
  async get() {
    const data = this.db.docs.get(this.path);
    return { exists: Boolean(data), id: this.id, data: () => data, ref: this };
  }
  async set(data: Data, options?: { merge?: boolean }) {
    this.db.docs.set(this.path, options?.merge ? { ...this.db.docs.get(this.path), ...data } : data);
  }
  async update(data: Data) { await this.set(data, { merge: true }); }
}

class FakeQuery {
  readonly clauses: Array<[string, string, unknown]> = [];
  constructor(private readonly db: FakeDb) {}
  where(field: string, operator: string, value: unknown) {
    this.clauses.push([field, operator, value]);
    return this;
  }
  async get() { return { docs: this.db.ingests }; }
}

class FakeDb {
  readonly docs = new Map<string, Data>();
  readonly ingests: FakeRef[] = [];
  readonly query = new FakeQuery(this);
  collection = (name: string) => ({ doc: (id: string) => new FakeRef(`${name}/${id}`, this) });
  collectionGroup = () => this.query;
}

describe("batch output consumer", () => {
  beforeEach(() => {
    firestore.db = new FakeDb();
    firestore.db.docs.set("enrichmentJobs/job-a", { ownerId: "owner-a" });
    firestore.db.docs.set("fontfamilies/owner-a__family-a", {
      id: "family-a", status: "enriching", hidden: false, version: 3,
      enrichmentJobId: "run-a", enrichmentJobVersion: 3,
    });
    const ingest = new FakeRef("users/owner-a/ingests/ingest-a", firestore.db);
    firestore.db.docs.set(ingest.path, {
      familyId: "family-a", enrichmentJobId: "run-a", enrichmentJobVersion: 3,
      analysisState: "analyzing", status: "processing",
    });
    firestore.db.ingests.push(ingest);
  });

  it("applies a valid v2 row and finalizes its run-tagged ingest", async () => {
    const key = buildBatchCatalogKey({
      jobId: "job-a", familyId: "family-a", familyVersion: 3,
      promptVersion: "prompt-v3", analysisModel: "gemini-test",
      embeddingVersion: "embed-v2:768", providerRunId: "run-a",
    });

    expect(await applyOutputRow({ key, response: { candidates: [{ content: { parts: [{ text: "{}" }] } }] } })).toBe(true);
    expect(firestore.db?.docs.get("users/owner-a/ingests/ingest-a")).toMatchObject({
      analysisState: "complete", status: "completed",
    });
    expect(firestore.db?.query.clauses).toEqual([
      ["familyId", "==", "family-a"],
      ["enrichmentJobId", "==", "run-a"],
      ["enrichmentJobVersion", "==", 3],
    ]);
  });
});
