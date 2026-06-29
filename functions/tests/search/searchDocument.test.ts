import { describe, expect, it } from "vitest";
import {
  buildLaneEmbeddingText,
  buildQueryLaneInput,
  buildSearchDocument,
  isSearchIndexedAtVersion,
  tokenizeSearchText,
} from "../../src/search/searchDocument";
import { family } from "./searchDocumentFixtures";

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

  it("requires explicit ready index state before treating vectors as current", () => {
    const version = { embeddingVersion: "v1", promptVersion: "p1" };
    expect(isSearchIndexedAtVersion({
      ...family(),
      searchIndexState: "ready",
      searchText: "Atlas",
      searchTokens: ["atlas"],
      searchMeta: version,
      text_vec: {},
      mood_vec: {},
      use_case_vec: {},
    }, version)).toBe(true);
    expect(isSearchIndexedAtVersion({ ...family(), searchText: "Atlas", searchTokens: ["atlas"], searchMeta: version, text_vec: {}, mood_vec: {}, use_case_vec: {} }, version)).toBe(false);
  });
});
