import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FontFamilyDoc, FontEnrichment } from "../../src/models/catalog.models";

const embedText = vi.fn();

vi.mock("../../src/ai/embeddings", () => ({
  embedText: (...args: unknown[]) => embedText(...args),
  embeddingModelId: () => "test-embedding",
  embeddingDims: () => 3,
}));

function family(): FontFamilyDoc {
  return {
    id: "user-1__inter",
    slug: "inter",
    name: "Inter",
    fileBase: "Inter",
    category: "SANS_SERIF",
    faces: [],
    status: "ready",
    version: 1,
  };
}

const enrichment: FontEnrichment = {
  category: "SANS_SERIF",
  summary: "A useful sans.",
  moods: ["neutral"],
  useCases: ["ui"],
  promptVersion: "enrich-v1",
};

describe("buildEnrichmentUpdate", () => {
  beforeEach(() => {
    embedText.mockReset();
  });

  it("marks search ready only when all vector lanes are present", async () => {
    embedText.mockResolvedValue([0.1, 0.2, 0.3]);
    const { buildEnrichmentUpdate } = await import("../../src/ai/enrich/update");
    const update = await buildEnrichmentUpdate(family(), enrichment);

    expect(update.status).toBe("enriched");
    expect(update.searchIndexState).toBe("ready");
    expect(update.searchMeta).toMatchObject({ embeddingVersion: "test-embedding:3" });
    expect(update.text_vec).toBeDefined();
    expect(update.mood_vec).toBeDefined();
    expect(update.use_case_vec).toBeDefined();
  });

  it("keeps the family retryable when any vector lane is missing", async () => {
    embedText.mockResolvedValueOnce([0.1, 0.2, 0.3]).mockResolvedValueOnce(null).mockResolvedValueOnce([0.2, 0.3, 0.4]);
    const { buildEnrichmentUpdate } = await import("../../src/ai/enrich/update");
    const update = await buildEnrichmentUpdate(family(), enrichment);

    expect(update.status).toBe("ready");
    expect(update.searchIndexState).toBe("retry");
    expect(update.searchIndexError).toBe("missing_vector_lane");
  });
});
