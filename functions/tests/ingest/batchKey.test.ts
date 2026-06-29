import { describe, expect, it } from "vitest";
import { buildBatchCatalogKey, parseBatchCatalogKey } from "../../src/ingest/batch/key";

describe("batch catalog keys", () => {
  it("round-trips family, job, and version", () => {
    const key = buildBatchCatalogKey("user-1__inter", "enrich-123", 4);
    expect(parseBatchCatalogKey(key)).toEqual({
      familyId: "user-1__inter",
      jobId: "enrich-123",
      version: 4,
    });
  });

  it("keeps legacy keys readable as family ids", () => {
    expect(parseBatchCatalogKey("legacy-family")).toEqual({ familyId: "legacy-family" });
  });
});
