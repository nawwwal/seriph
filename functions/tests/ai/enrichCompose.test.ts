import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FontFamilyDoc } from "../../src/models/catalog.models";

const config = vi.hoisted(() => ({ jevEnabled: false }));

vi.mock("firebase-functions", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../src/ai/embeddings", () => ({
  embeddingModelId: () => "embed",
  embeddingDims: () => 3,
}));

vi.mock("../../src/config/remoteConfig", () => ({
  getConfigValue: () => "gemini-test",
  getConfigBoolean: (key: string) => key === "jev_enrichment_enabled" && config.jevEnabled,
  getConfigNumber: () => 0.5,
}));

import { parseAnalysis } from "../../src/ai/enrich/parse";
import { composeEnrichment } from "../../src/ai/enrich/compose";
import { toSearchItem } from "../../src/search/searchResults";
import { matchesSearchFilters } from "../../src/search/searchFilters";
import { buildSearchDocument } from "../../src/search/searchDocument";

function family(overrides: Partial<FontFamilyDoc> = {}): FontFamilyDoc {
  return {
    id: "probe",
    slug: "probe",
    name: "Probe",
    fileBase: "Probe",
    category: "SANS_SERIF",
    faces: [],
    status: "ready",
    version: 1,
    ...overrides,
  };
}

describe("composeEnrichment", () => {
  beforeEach(() => {
    config.jevEnabled = false;
  });

  it("drops off-taxonomy Gemini moods and keeps taxonomy members", () => {
    const enrichment = parseAnalysis(family(), JSON.stringify({
      category: "SANS_SERIF",
      summary: "A compact grotesque family.",
      moods: ["Warm", "editorial", "technical"],
      useCases: ["UI", "magazine decks", "headlines"],
    }));

    expect(enrichment?.moods).toEqual(["warm", "technical"]);
    expect(enrichment?.useCases).toEqual(["ui", "headlines"]);
  });

  it("keeps Gemini labels when Jev is off or the labeler fails", async () => {
    const payload = JSON.stringify({
      category: "SANS_SERIF",
      summary: "A compact grotesque family.",
      moods: ["warm"],
      useCases: ["ui"],
    });
    config.jevEnabled = false;
    const off = await composeEnrichment(family(), payload);
    expect(off?.jevVersion).toBeUndefined();
    expect(off?.moods).toEqual(["warm"]);

    config.jevEnabled = true;
    const failed = await composeEnrichment(family(), payload, async () => {
      throw new Error("typesafe_http_500");
    });
    expect(failed?.jevVersion).toBeUndefined();
    expect(failed?.moods).toEqual(["warm"]);
  });

  it("stores Jev maps when the labeler succeeds", async () => {
    config.jevEnabled = true;
    const payload = JSON.stringify({
      category: "SANS_SERIF",
      summary: "A compact grotesque family.",
      moods: ["warm"],
      useCases: ["ui"],
    });
    const labeled = await composeEnrichment(family(), payload, async (_family, enrichment) => ({
      ...enrichment,
      moods: ["warm", "technical"],
      useCases: ["ui"],
      moodScores: { warm: 0.9, technical: 0.8 },
      useCaseScores: { ui: 0.7 },
      jevModel: "jev-1.13.0",
      jevVersion: "jev-labels-v1",
    }));

    expect(labeled?.moods).toEqual(["warm", "technical"]);
    expect(labeled?.moodScores?.warm).toBe(0.9);
    expect(labeled?.jevVersion).toBe("jev-labels-v1");
  });
});

describe("search taxonomy labels", () => {
  it("puts normalized moods in search tokens and result items", () => {
    const doc = family({
      enrichment: {
        category: "SANS_SERIF",
        summary: "A compact grotesque family.",
        moods: ["warm", "precise"],
        useCases: ["ui"],
      },
    });
    const tokens = buildSearchDocument(doc, {
      embeddingModel: "embed",
      embeddingVersion: "embed:3",
      promptVersion: "enrich-v2",
    }).searchTokens as string[];

    expect(tokens).toContain("warm");
    expect(tokens).toContain("ui");
    expect(tokens).not.toContain("precise");
    expect(toSearchItem(doc).moods).toEqual(["warm"]);
  });

  it("still returns a SANS_SERIF family whose classification is a serif", () => {
    const familyDoc = {
      id: "ivar-display",
      slug: "ivar-display",
      name: "Ivar Display",
      category: "SANS_SERIF" as const,
      classification: "Sans Serif",
      faces: [],
      status: "enriched" as const,
      version: 1,
      enrichment: { classification: "high-contrast transitional display serif", moods: ["classic"] },
    };

    expect(toSearchItem(familyDoc).classification).toBe("Serif");
    expect(matchesSearchFilters(familyDoc, { filters: { classifications: ["Serif"] } })).toBe(true);
    expect(toSearchItem(familyDoc).moods).toEqual(["classic"]);
  });
});
