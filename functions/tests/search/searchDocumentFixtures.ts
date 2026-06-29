import type { FontFamilyDoc } from "../../src/models/catalog.models";

export function family(overrides: Partial<FontFamilyDoc> = {}): FontFamilyDoc {
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
