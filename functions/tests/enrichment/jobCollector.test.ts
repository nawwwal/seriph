import { describe, expect, it } from "vitest";
import type { FontFamilyDoc } from "../../src/models/catalog.models";
import { collectEnrichmentJobs } from "../../src/enrichment/jobs/collector";
import { enrichmentJobId, type EnrichmentJob } from "../../src/enrichment/jobs/jobTypes";
import { firestoreEnrichmentJobStore } from "../../src/enrichment/jobs/jobStore";

const key = {
  familyId: "owner__atlas",
  familyVersion: 7,
  promptVersion: "prompt-v3",
  analysisModel: "gemini-test",
  embeddingVersion: "embed-v2:768",
};

const job = (familyId: string, overrides: Partial<EnrichmentJob> = {}): EnrichmentJob => ({
  ...key,
  familyId,
  jobId: enrichmentJobId({ ...key, familyId }),
  ownerId: "owner",
  batchId: "batch",
  planVersion: 4,
  state: "queued",
  ...overrides,
});

const family = (id: string, overrides: Partial<FontFamilyDoc> = {}): FontFamilyDoc => ({
  id,
  slug: id,
  name: id,
  fileBase: id,
  category: "SANS_SERIF",
  ownerId: "owner",
  status: "ready",
  version: 7,
  faces: [{
    id: "regular",
    styleName: "Regular",
    weight: 400,
    weightName: "Regular",
    width: 100,
    italic: false,
    isVariable: false,
    format: "WOFF2",
    fileSize: 10,
    filename: "regular.woff2",
    woff2: { storagePath: "fonts/regular.woff2", url: "https://example.test/regular.woff2" },
    original: { storagePath: "fonts/regular.otf", url: "https://example.test/regular.otf" },
    preferredAssetId: "asset-1",
    assets: [{
      id: "asset-1",
      contentHash: "hash",
      containerFormat: "WOFF2",
      technology: "WOFF2",
      originalName: "regular.otf",
      original: { storagePath: "fonts/regular.otf", url: "https://example.test/regular.otf" },
      served: { storagePath: "fonts/regular.woff2", url: "https://example.test/regular.woff2" },
      source: { batchId: "batch", sourceId: "source", itemId: "item", originalPath: "regular.otf" },
    }],
  }],
  ...overrides,
});

class JobDb {
  docs = new Map<string, Record<string, unknown>>();
  collection = (name: string) => ({ doc: (id: string) => ({
    path: `${name}/${id}`,
    get: async () => ({ exists: this.docs.has(`${name}/${id}`), data: () => this.docs.get(`${name}/${id}`) }),
    set: async (data: Record<string, unknown>, options?: { merge?: boolean }) => {
      this.docs.set(`${name}/${id}`, options?.merge ? { ...this.docs.get(`${name}/${id}`), ...data } : data);
    },
  })});
  runTransaction = async <T>(run: (tx: { get: (ref: { path: string }) => Promise<unknown>; set: (ref: { path: string }, data: Record<string, unknown>) => void }) => Promise<T>) => run({
    get: async (ref) => ({ exists: this.docs.has(ref.path), data: () => this.docs.get(ref.path) }),
    set: (ref, data) => { this.docs.set(ref.path, data); },
  });
}

describe("enrichment jobs", () => {
  it("keys a job by family and every output-affecting version", () => {
    expect(enrichmentJobId(key)).toBe(enrichmentJobId(key));
    expect(enrichmentJobId({ ...key, familyVersion: 8 })).not.toBe(enrichmentJobId(key));
    expect(enrichmentJobId({ ...key, promptVersion: "prompt-v4" })).not.toBe(enrichmentJobId(key));
    expect(enrichmentJobId({ ...key, analysisModel: "gemini-next" })).not.toBe(enrichmentJobId(key));
    expect(enrichmentJobId({ ...key, embeddingVersion: "embed-v3:768" })).not.toBe(enrichmentJobId(key));
  });

  it("marks disabled jobs skipped without blocking the deterministic batch", async () => {
    const jobs = [job("atlas"), job("boreal", { familyId: "boreal" })];
    const states: Array<[string, string]> = [];

    await expect(collectEnrichmentJobs({
      enabled: false,
      jobs,
      maxBatchSize: 2,
      loadFamily: async () => family("unused"),
      render: async () => Buffer.from("png"),
      markState: async (entry, state) => { states.push([entry.jobId, state]); },
      submit: async () => { throw new Error("disabled jobs must not submit"); },
    })).resolves.toMatchObject({ skippedDisabled: 2, submitted: 0 });

    expect(states).toHaveLength(2);
    expect(states.every(([, state]) => state === "skipped_disabled")).toBe(true);
  });

  it("isolates invalid and unrenderable families while submitting valid jobs", async () => {
    const jobs = [job("good"), job("ownerless"), job("unrenderable")];
    const states: Array<[string, string]> = [];
    const submitted: EnrichmentJob[][] = [];
    const families = {
      good: family("good"),
      ownerless: family("ownerless", { ownerId: undefined }),
      unrenderable: family("unrenderable"),
    };

    const result = await collectEnrichmentJobs({
      enabled: true,
      jobs,
      maxBatchSize: 2,
      loadFamily: async (entry) => families[entry.familyId as keyof typeof families],
      render: async (entry) => {
        if (entry.id === "unrenderable") throw new Error("missing preferred asset");
        return Buffer.from("png");
      },
      markState: async (entry, state) => { states.push([entry.jobId, state]); },
      submit: async (batch) => { submitted.push([...batch]); },
    });

    expect(result).toMatchObject({ rejected: 2, submitted: 1, skippedDisabled: 0 });
    expect(submitted).toHaveLength(1);
    expect(submitted[0]?.map((entry) => entry.familyId)).toEqual(["good"]);
    expect(states.filter(([, state]) => state === "failed")).toHaveLength(2);
  });

  it("creates one durable job on repeated delivery", async () => {
    const db = new JobDb();
    const store = firestoreEnrichmentJobStore(db as never, () => new Date("2030-01-01"));
    const input = { ...key, ownerId: "owner", batchId: "batch", planVersion: 4 };

    const first = await store.create(input);
    const second = await store.create(input);

    expect(second).toEqual(first);
    expect(db.docs).toHaveLength(1);
    expect(first).toMatchObject({ jobId: enrichmentJobId(key), state: "queued" });
  });
});
