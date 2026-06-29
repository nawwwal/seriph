import { describe, expect, it } from "vitest";
import type { FontFamilyDoc } from "../../src/models/catalog.models";
import {
  DEFAULT_SEARCH_WEIGHTS,
  exactMatchScore,
  fuseCandidateScore,
  mergeSearchCandidate,
  semanticScoreFromDistance,
} from "../../src/search/scoring";

function family(id: string, overrides: Partial<FontFamilyDoc> = {}): FontFamilyDoc {
  return {
    id,
    slug: id,
    name: id === "garamond-premier" ? "Garamond Premier" : "Warm Sans",
    fileBase: id,
    category: id === "garamond-premier" ? "SERIF" : "SANS_SERIF",
    faces: [],
    status: "enriched",
    version: 1,
    searchTokens: id === "garamond-premier" ? ["garamond", "premier", "serif"] : ["warm", "sans", "branding"],
    enrichment: {
      category: id === "garamond-premier" ? "SERIF" : "SANS_SERIF",
      moods: id === "garamond-premier" ? ["editorial"] : ["warm"],
      useCases: id === "garamond-premier" ? ["books"] : ["branding"],
      confidence: 0.9,
    },
    ...overrides,
  };
}

describe("search scoring", () => {
  it("normalizes Firestore cosine distance into a bounded semantic score", () => {
    expect(semanticScoreFromDistance(0)).toBe(1);
    expect(semanticScoreFromDistance(0.25)).toBe(0.75);
    expect(semanticScoreFromDistance(2)).toBe(0);
  });

  it("scores exact name and token matches higher than loose token overlap", () => {
    expect(exactMatchScore("Garamond Premier", family("garamond-premier"))).toBe(1);
    expect(exactMatchScore("branding", family("warm-sans"))).toBeGreaterThan(0.5);
    expect(exactMatchScore("cold brutalist", family("warm-sans"))).toBe(0);
  });

  it("deduplicates candidates by family id and preserves lane evidence", () => {
    const candidates = new Map<string, ReturnType<typeof mergeSearchCandidate>>();
    mergeSearchCandidate(candidates, family("warm-sans"), { lane: "text", score: 0.5 });
    mergeSearchCandidate(candidates, family("warm-sans"), { lane: "mood", score: 0.9 });

    const candidate = candidates.get("warm-sans");
    expect(candidate?.scores.textSemantic).toBe(0.5);
    expect(candidate?.scores.moodSemantic).toBe(0.9);
    expect(candidates.size).toBe(1);
  });

  it("fuses weighted lanes deterministically and lets exact names beat weak semantic matches", () => {
    const exact = fuseCandidateScore(
      {
        textSemantic: 0.1,
        moodSemantic: 0,
        useCaseSemantic: 0,
        exact: 1,
        quality: 0.8,
      },
      DEFAULT_SEARCH_WEIGHTS
    );
    const weakSemantic = fuseCandidateScore(
      {
        textSemantic: 0.18,
        moodSemantic: 0.1,
        useCaseSemantic: 0.1,
        exact: 0,
        quality: 0.8,
      },
      DEFAULT_SEARCH_WEIGHTS
    );

    expect(exact).toBeGreaterThan(weakSemantic);
  });
});
