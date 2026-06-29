import { describe, expect, it } from "vitest";
import type { FontFamilyDoc } from "../../src/models/catalog.models";
import {
  buildLaneEmbeddingText,
  buildQueryLaneInput,
  buildSearchDocument,
  tokenizeSearchText,
} from "../../src/search/searchDocument";

function family(overrides: Partial<FontFamilyDoc> = {}): FontFamilyDoc {
  return {
    id: "atlas-grotesk",
    slug: "atlas-grotesk",
    name: "Atlas Grotesk",
    fileBase: "AtlasGrotesk",
    category: "SANS_SERIF",
    classification: "neo grotesque sans",
    foundry: "Commercial Type",
    faces: [
      {
        id: "regular",
        styleName: "Regular",
        weight: 400,
        weightName: "Regular",
        italic: false,
        isVariable: false,
        format: "OTF",
        fileSize: 1200,
        filename: "AtlasGrotesk-Regular.woff2",
        woff2: { storagePath: "s/atlas/1/regular.woff2", url: "https://example.com/regular.woff2" },
        original: { storagePath: "raw/atlas.otf", url: "https://example.com/raw.otf" },
      },
    ],
    enrichment: {
      category: "SANS_SERIF",
      classification: "editorial grotesque",
      summary: "A clear, warm grotesque for dense editorial systems.",
      moods: ["warm", "precise", "editorial"],
      voice: "quietly authoritative",
      useCases: ["editorial headlines", "magazine decks", "brand systems"],
      pairingHints: ["pairs with high contrast serif"],
      confidence: 0.82,
      promptVersion: "enrich-v1",
      embeddingVersion: "gemini-embedding-2-preview:768",
    },
    status: "enriched",
    version: 1,
    ...overrides,
  };
}

describe("search document utilities", () => {
  it("normalizes and deduplicates searchable tokens across metadata and enrichment", () => {
    expect(tokenizeSearchText(["Atlas Grotesk", "SANS_SERIF", "editorial headlines", "editorial"])).toEqual([
      "atlas",
      "grotesk",
      "sans",
      "serif",
      "editorial",
      "headlines",
    ]);
  });

  it("builds lane-specific embedding inputs for broad text, mood, and use case retrieval", () => {
    const doc = family();

    expect(buildLaneEmbeddingText(doc, "text")).toContain("dense editorial systems");
    expect(buildLaneEmbeddingText(doc, "mood")).toContain("warm");
    expect(buildLaneEmbeddingText(doc, "mood")).toContain("quietly authoritative");
    expect(buildLaneEmbeddingText(doc, "useCase")).toContain("magazine decks");
    expect(buildLaneEmbeddingText(doc, "useCase")).toContain("pairs with high contrast serif");
  });

  it("builds clean lane query inputs without injecting document metadata", () => {
    expect(buildQueryLaneInput("Warm geometric sans", "mood")).toBe("warm geometric sans");
    expect(buildQueryLaneInput("Warm geometric sans", "useCase")).not.toContain("display");
  });

  it("builds persisted search fields and current search metadata", () => {
    const update = buildSearchDocument(family(), {
      embeddingModel: "gemini-embedding-2-preview",
      embeddingVersion: "gemini-embedding-2-preview:768",
      promptVersion: "enrich-v1",
    });

    expect(update.searchText).toContain("Atlas Grotesk");
    expect(update.searchTokens).toContain("editorial");
    expect(update.searchTokens).toContain("warm");
    expect(update.searchMeta).toMatchObject({
      embeddingModel: "gemini-embedding-2-preview",
      embeddingVersion: "gemini-embedding-2-preview:768",
      promptVersion: "enrich-v1",
    });
  });
});
