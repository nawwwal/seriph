import { describe, expect, it } from "vitest";
import { buildBatchCatalogKey, parseBatchCatalogKey } from "../../src/ingest/batch/key";

describe("batch catalog keys", () => {
  it("round-trips the canonical provider key", () => {
    const key = buildBatchCatalogKey({
      familyId: "user-1__inter",
      jobId: "enrich-123",
      familyVersion: 4,
      promptVersion: "prompt-v1",
      analysisModel: "analysis-test",
      embeddingVersion: "embedding-v1",
      providerRunId: "run-123",
    });
    expect(parseBatchCatalogKey(key)).toEqual({
      familyId: "user-1__inter",
      jobId: "enrich-123",
      familyVersion: 4,
      promptVersion: "prompt-v1",
      analysisModel: "analysis-test",
      embeddingVersion: "embedding-v1",
      providerRunId: "run-123",
      version: 4,
    });
  });

  it("rejects unscoped legacy family keys", () => {
    expect(parseBatchCatalogKey("legacy-family")).toBeNull();
  });
});
