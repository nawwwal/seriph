import { beforeEach, describe, expect, it, vi } from "vitest";
import { queries, resetSearchHarness, setSearchScenario } from "./searchFontsHarness";

vi.mock("firebase-functions", () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}));

vi.mock("../../src/search/queryEmbeddingCache", () => ({
  getOrCreateQueryEmbedding: vi.fn(async () => [0.1, 0.2, 0.3]),
}));

describe("searchFonts", () => {
  beforeEach(() => {
    resetSearchHarness();
  });

  it("lets editorial queries rank through the use-case vector lane", async () => {
    const { searchFonts } = await import("../../src/search/searchFonts");
    const response = await searchFonts({ q: "editorial", filters: { ownerId: "owner-1" }, limit: 5, debug: true });

    expect(response.results[0]?.id).toBe("editorial-grotesk");
    expect(response.results[0]?.scoreBreakdown?.useCaseSemantic).toBeGreaterThan(0.9);
  });

  it("lets warm queries rank through the mood vector lane", async () => {
    setSearchScenario("mood");
    const { searchFonts } = await import("../../src/search/searchFonts");
    const response = await searchFonts({ q: "warm", filters: { ownerId: "owner-1" }, limit: 5, debug: true });

    expect(response.results[0]?.id).toBe("warm-sans");
    expect(response.results[0]?.scoreBreakdown?.moodSemantic).toBeGreaterThan(0.9);
  });

  it("lets an exact family name outrank weak semantic matches", async () => {
    setSearchScenario("exactName");
    const { searchFonts } = await import("../../src/search/searchFonts");
    const response = await searchFonts({ q: "Garamond Premier", filters: { ownerId: "owner-1" }, limit: 5, debug: true });

    expect(response.results[0]?.id).toBe("garamond-premier");
    expect(response.results[0]?.scoreBreakdown?.exact).toBe(1);
  });

  it("applies owner filtering to all Firestore lanes", async () => {
    const { searchFonts } = await import("../../src/search/searchFonts");
    await searchFonts({ q: "editorial", filters: { ownerId: "owner-1" }, limit: 5 });

    const laneQueries = queries.filter((query) => query.vectorField || query.filters.some(([field]) => field === "searchTokens"));
    expect(laneQueries.length).toBeGreaterThanOrEqual(4);
    expect(laneQueries.every((query) => query.filters.some(([field, op, value]) => field === "ownerId" && op === "==" && value === "owner-1"))).toBe(true);
  });

  it("falls back to ready/enriched listing when the query is empty", async () => {
    setSearchScenario("fallback");
    const { searchFonts } = await import("../../src/search/searchFonts");
    const response = await searchFonts({ filters: { ownerId: "owner-1" }, limit: 5 });

    expect(response.results.map((result) => result.id)).toEqual(["editorial-grotesk", "warm-sans"]);
  });

  it("coarsens enrichment classification phrases for result labels and filters", async () => {
    const { toSearchItem } = await import("../../src/search/searchResults");
    const { matchesSearchFilters } = await import("../../src/search/searchFilters");
    const family = {
      id: "ivar-display",
      slug: "ivar-display",
      name: "Ivar Display",
      category: "SANS_SERIF",
      classification: "Sans Serif",
      faces: [],
      status: "enriched",
      version: 1,
      enrichment: { classification: "high-contrast transitional display serif" },
    };

    expect(toSearchItem(family).classification).toBe("Serif");
    expect(matchesSearchFilters(family, { filters: { classifications: ["Serif"] } })).toBe(true);
  });
});
