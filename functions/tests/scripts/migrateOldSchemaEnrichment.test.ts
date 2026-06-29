import { describe, expect, it } from "vitest";
import {
  buildLegacyEnrichment,
  repairFaceVariableState,
} from "../../src/scripts/migrateOldSchemaFonts";
import type { FontFace } from "../../src/models/catalog.models";

function baseFace(): FontFace {
  return {
    id: "regular",
    styleName: "Regular",
    weight: 400,
    weightName: "Regular",
    italic: false,
    isVariable: true,
    axes: [],
    format: "OTF",
    fileSize: 1,
    filename: "Family-Regular.woff2",
    woff2: { storagePath: "s/family/v/Family-Regular.woff2", url: "https://seriph.web.app/s/family/v/Family-Regular.woff2" },
    original: { storagePath: "d/family/v/Family-Regular.otf", url: "https://seriph.web.app/d/family/v/Family-Regular.otf" },
  };
}

describe("old schema enrichment repair", () => {
  it("repairs stale variable flags from old parser output", () => {
    const face = baseFace();
    expect(repairFaceVariableState(face)).toMatchObject({ isVariable: false, axes: undefined });
    expect(repairFaceVariableState({ ...face, axes: [{ tag: "wght", min: 100, max: 900, default: 400 }] })).toMatchObject({
      isVariable: true,
      axes: [{ tag: "wght", min: 100, max: 900, default: 400 }],
    });
  });

  it("maps useful legacy family metadata into current enrichment fields", () => {
    expect(buildLegacyEnrichment({
      description: "A warm editorial family.",
      tags: ["warm", "editorial"],
      classification: "Serif",
      metadata: { subClassification: "transitional serif", moods: ["literary"], useCases: ["magazines", "essays"] },
    }, "SERIF")).toEqual({
      category: "SERIF",
      classification: "transitional serif",
      summary: "A warm editorial family.",
      moods: ["warm", "editorial", "literary"],
      useCases: ["magazines", "essays"],
      modelId: "legacy-schema-migration",
      promptVersion: "legacy-schema",
    });
  });

  it("omits missing optional enrichment fields instead of writing undefined", () => {
    const enrichment = buildLegacyEnrichment({ tags: ["warm"] }, "SANS_SERIF");
    expect(enrichment).toEqual({
      category: "SANS_SERIF",
      moods: ["warm"],
      modelId: "legacy-schema-migration",
      promptVersion: "legacy-schema",
    });
    expect(enrichment).not.toHaveProperty("summary");
    expect(enrichment).not.toHaveProperty("classification");
    expect(enrichment).not.toHaveProperty("useCases");
  });
});
