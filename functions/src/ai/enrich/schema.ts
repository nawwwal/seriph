import type { FontEnrichment, FontFamilyDoc } from "../../models/catalog.models";
import { buildLaneEmbeddingText } from "../../search/searchDocument";

export const PROMPT_VERSION = "enrich-v1";

/** Line marker used to correlate batch output rows back to a catalog family document. */
export const CATALOG_KEY_PREFIX = "Catalog-Key:";

export const ANALYSIS_SCHEMA = {
  type: "OBJECT",
  properties: {
    category: { type: "STRING", enum: ["SERIF", "SANS_SERIF", "DISPLAY", "HANDWRITING", "MONOSPACE"] },
    suggestedDisplayName: { type: "STRING" },
    classification: { type: "STRING" },
    summary: { type: "STRING" },
    moods: { type: "ARRAY", items: { type: "STRING" } },
    voice: { type: "STRING" },
    useCases: { type: "ARRAY", items: { type: "STRING" } },
    pairingHints: { type: "ARRAY", items: { type: "STRING" } },
    confidence: { type: "NUMBER" },
  },
  required: ["category", "summary", "moods", "useCases"],
} as const;

export function buildPrompt(family: FontFamilyDoc, hasImage: boolean, withKey = false, catalogKey = family.id || family.slug): string {
  const axes = (family.axes ?? []).map((a) => a.tag).join(", ") || "none";
  return [
    ...(withKey ? [`${CATALOG_KEY_PREFIX} ${catalogKey}`, ""] : []),
    "You are a typography expert cataloguing a font family for a searchable library.",
    hasImage
      ? "You are shown a rendered specimen image of the typeface. Judge its visual character from the image."
      : "No specimen image is available; infer from the metadata only.",
    "",
    `Family: ${family.name}`,
    family.manualMerge?.displayNamePending
      ? "This family was manually grouped from multiple family cards. If the current family name looks like a weight/style fragment or otherwise too mechanical, return a cleaner suggestedDisplayName for the visible display name. Do not invent a foundry prefix that is not present in the metadata."
      : "Only include suggestedDisplayName when the supplied family name is visibly wrong or incomplete.",
    `Deterministic classification: ${family.classification ?? "unknown"}`,
    `Foundry/designer: ${family.foundry ?? family.designer ?? "unknown"}`,
    `Variable axes: ${axes}`,
    `Styles: ${family.faces.map((f) => f.styleName).join(", ")}`,
    "",
    'Return JSON describing: the primary category; an optional suggestedDisplayName; a finer classification (e.g. "humanist sans", "transitional serif", "geometric display"); a 1–2 sentence summary of its character; 4–8 mood/voice adjectives (e.g. warm, technical, editorial, playful); a short "voice" phrase; 3–6 concrete use cases (e.g. body text, branding, UI, editorial headlines); 2–4 pairing hints (kinds of fonts that pair well); and a 0–1 confidence.',
  ].join("\n");
}

export function buildEmbeddingText(family: FontFamilyDoc, e: FontEnrichment): string {
  return buildLaneEmbeddingText({ ...family, enrichment: e }, "text");
}

export function buildMoodEmbeddingText(family: FontFamilyDoc, e: FontEnrichment): string {
  return buildLaneEmbeddingText({ ...family, enrichment: e }, "mood");
}

export function buildUseCaseEmbeddingText(family: FontFamilyDoc, e: FontEnrichment): string {
  return buildLaneEmbeddingText({ ...family, enrichment: e }, "useCase");
}
