import type { FontEnrichment, FontFamilyDoc } from "../../models/catalog.models";

export const PROMPT_VERSION = "enrich-v1";

/** Line marker used to correlate batch output rows back to a family slug. */
export const CATALOG_KEY_PREFIX = "Catalog-Key:";

export const ANALYSIS_SCHEMA = {
  type: "OBJECT",
  properties: {
    category: { type: "STRING", enum: ["SERIF", "SANS_SERIF", "DISPLAY", "HANDWRITING", "MONOSPACE"] },
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

export function buildPrompt(family: FontFamilyDoc, hasImage: boolean, withKey = false): string {
  const axes = (family.axes ?? []).map((a) => a.tag).join(", ") || "none";
  return [
    ...(withKey ? [`${CATALOG_KEY_PREFIX} ${family.slug}`, ""] : []),
    "You are a typography expert cataloguing a font family for a searchable library.",
    hasImage
      ? "You are shown a rendered specimen image of the typeface. Judge its visual character from the image."
      : "No specimen image is available; infer from the metadata only.",
    "",
    `Family: ${family.name}`,
    `Deterministic classification: ${family.classification ?? "unknown"}`,
    `Foundry/designer: ${family.foundry ?? family.designer ?? "unknown"}`,
    `Variable axes: ${axes}`,
    `Styles: ${family.faces.map((f) => f.styleName).join(", ")}`,
    "",
    'Return JSON describing: the primary category; a finer classification (e.g. "humanist sans", "transitional serif", "geometric display"); a 1–2 sentence summary of its character; 4–8 mood/voice adjectives (e.g. warm, technical, editorial, playful); a short "voice" phrase; 3–6 concrete use cases (e.g. body text, branding, UI, editorial headlines); 2–4 pairing hints (kinds of fonts that pair well); and a 0–1 confidence.',
  ].join("\n");
}

export function buildEmbeddingText(family: FontFamilyDoc, e: FontEnrichment): string {
  return [
    family.name,
    e.classification || family.classification,
    e.summary,
    e.voice,
    (e.moods || []).join(", "),
    (e.useCases || []).join(", "),
    (e.pairingHints || []).join(", "),
    family.foundry,
  ]
    .filter(Boolean)
    .join(". ");
}
