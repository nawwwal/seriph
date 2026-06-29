import { describe, expect, it } from "vitest";
import type { FontFamilyDoc } from "../../src/models/catalog.models";
import { parseBackfillArgs, shouldBackfillFamily } from "../../src/scripts/backfillSearchVectors";

function family(overrides: Partial<FontFamilyDoc> = {}): FontFamilyDoc {
  return {
    id: "editorial-sans",
    slug: "editorial-sans",
    name: "Editorial Sans",
    fileBase: "EditorialSans",
    category: "SANS_SERIF",
    faces: [],
    status: "enriched",
    version: 1,
    searchText: "Editorial Sans",
    searchTokens: ["editorial", "sans"],
    searchMeta: {
      embeddingModel: "gemini-embedding-2-preview",
      embeddingVersion: "gemini-embedding-2-preview:768",
      promptVersion: "enrich-v1",
    },
    text_vec: {},
    mood_vec: {},
    use_case_vec: {},
    ...overrides,
  };
}

describe("search vector backfill helpers", () => {
  it("skips docs already indexed at the current search version", () => {
    expect(
      shouldBackfillFamily(
        family(),
        {
          embeddingVersion: "gemini-embedding-2-preview:768",
          promptVersion: "enrich-v1",
        },
        false
      )
    ).toBe(false);
  });

  it("updates stale docs and force-updates current docs", () => {
    expect(
      shouldBackfillFamily(
        family({ searchMeta: { embeddingModel: "old", embeddingVersion: "old:768", promptVersion: "enrich-v1" } }),
        {
          embeddingVersion: "gemini-embedding-2-preview:768",
          promptVersion: "enrich-v1",
        },
        false
      )
    ).toBe(true);

    expect(
      shouldBackfillFamily(
        family(),
        {
          embeddingVersion: "gemini-embedding-2-preview:768",
          promptVersion: "enrich-v1",
        },
        true
      )
    ).toBe(true);
  });

  it("parses owner, limit, force, and dry-run arguments", () => {
    expect(parseBackfillArgs(["--ownerId=user-1", "--limit=25", "--force", "--dryRun"])).toEqual({
      ownerId: "user-1",
      limit: 25,
      force: true,
      dryRun: true,
    });
  });
});
