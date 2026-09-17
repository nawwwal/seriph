import { describe, expect, it } from "vitest";
import { censusEnrichmentLabels } from "../../src/scripts/auditEnrichmentLabels";

describe("enrichment label census", () => {
  it("counts off-taxonomy moods and normalizes case variants as in-taxonomy", () => {
    const census = censusEnrichmentLabels([
      { enrichment: { moods: ["warm", "Warm", "editorial"], useCases: ["ui", "magazine"] } },
      { enrichment: { moods: ["precise"], useCases: ["headlines"] } },
    ]);

    expect(census.families).toBe(2);
    expect(census.moods.find((row) => row.value === "warm")?.count).toBe(1);
    expect(census.moods.find((row) => row.value === "Warm")?.inTaxonomy).toBe(true);
    expect(census.moods.find((row) => row.value === "editorial")?.inTaxonomy).toBe(false);
    expect(census.useCases.find((row) => row.value === "magazine")?.inTaxonomy).toBe(false);
    expect(census.moodOffTaxonomyShare).toBe(2 / 4);
  });
});
