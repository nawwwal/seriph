import { describe, expect, it, vi } from "vitest";
import { buildBatchCatalogKey } from "../../src/ingest/batch/key";

const expected = ["a", "b", "c", "d", "e"].map((jobId) => ({
  jobId, familyId: `family-${jobId}`, familyVersion: 3, promptVersion: "p1",
  analysisModel: "model-1", embeddingVersion: "embed-1:3",
}));

function row(jobId: string, text = "{}", familyVersion = 3) {
  const item = expected.find((entry) => entry.jobId === jobId)!;
  return { key: buildBatchCatalogKey({ ...item, familyVersion, providerRunId: "run-1" }), response: { candidates: [{ content: { parts: [{ text }] } }] } };
}

describe("provider output reconciliation", () => {
  it("classifies missing, malformed, duplicate, stale, and valid rows independently", async () => {
    const { reconcileProviderOutput } = await import("../../src/enrichment/provider/reconcileOutput");
    const result = await reconcileProviderOutput({ id: "run-1", expectedJobIds: expected.map(({ jobId }) => jobId), expectedJobs: expected },
      [row("a"), row("c", "not-json"), row("d"), row("d"), row("e", "{}", 2)], { apply: async () => true });

    expect(result.byJob).toEqual({ a: "complete", b: "missing", c: "malformed", d: "duplicate", e: "stale" });
  });

  it("keeps prior vectors when replacement embedding fails", async () => {
    vi.resetModules();
    const state = { docs: new Map<string, Record<string, unknown>>() };
    vi.doMock("firebase-admin/firestore", () => ({
      getFirestore: () => ({ collection: (name: string) => ({ doc: (id: string) => ({
        id, get: async () => ({ exists: state.docs.has(`${name}/${id}`), data: () => state.docs.get(`${name}/${id}`) }),
        set: async (data: Record<string, unknown>, options?: { merge?: boolean }) => state.docs.set(`${name}/${id}`, options?.merge ? { ...state.docs.get(`${name}/${id}`), ...data } : data),
      }) }) }),
      FieldValue: { delete: () => "deleted", serverTimestamp: () => "timestamp", vector: (value: unknown) => value },
    }));
    vi.doMock("../../src/ai/enrichFont", () => ({
      CATALOG_KEY_PREFIX: "Catalog-Key:", parseAnalysis: () => ({ category: "SANS_SERIF", summary: "new", moods: [], useCases: [] }),
      buildEnrichmentUpdate: async () => ({ status: "ready", searchIndexState: "retry", text_vec: "deleted", mood_vec: "deleted", use_case_vec: "deleted" }),
    }));
    const previousVector = [0.1, 0.2, 0.3];
    state.docs.set("fontfamilies/family-a", { id: "family-a", status: "enriching", version: 3, enrichmentJobId: "run-1", enrichmentJobVersion: 3, text_vec: previousVector });
    const { applyOutputRow } = await import("../../src/ingest/batch/output");
    await applyOutputRow(row("a"));

    expect(state.docs.get("fontfamilies/family-a")?.text_vec).toEqual(previousVector);
  });
});
