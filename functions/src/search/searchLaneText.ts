import type { FontEnrichment, FontFamilyDoc } from "../models/catalog.models";
import { normalizeSearchText, tokenizeSearchText } from "./searchTextNormalize";
import type { SearchVectorLane } from "./searchDocumentTypes";

function cleanPart(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function cleanParts(values: unknown[]): string[] {
  return values.flatMap((value) => {
    if (Array.isArray(value)) return cleanParts(value);
    const cleaned = cleanPart(value);
    return cleaned ? [cleaned] : [];
  });
}

function enrichmentFor(family: FontFamilyDoc): FontEnrichment | undefined {
  return family.enrichment;
}

export function buildLaneEmbeddingText(family: FontFamilyDoc, lane: SearchVectorLane): string {
  const e = enrichmentFor(family);
  const classification = e?.classification ?? family.classification;
  const category = e?.category ?? family.category;
  const shared = cleanParts([family.name, family.fileBase, category, classification, family.foundry, family.designer]);

  if (lane === "mood") return cleanParts([...shared, e?.voice, e?.moods, e?.summary]).join(". ");
  if (lane === "useCase") return cleanParts([family.name, category, classification, e?.useCases, e?.pairingHints, e?.summary]).join(". ");

  return cleanParts([
    ...shared,
    e?.summary,
    e?.voice,
    e?.moods,
    e?.useCases,
    e?.pairingHints,
    family.license,
    family.subsets,
    (family.axes ?? []).map((axis) => [axis.tag, axis.name].filter(Boolean).join(" ")),
    (family.faces ?? []).map((face) => [face.styleName, face.weightName, face.fullName, face.postScriptName].filter(Boolean).join(" ")),
  ]).join(". ");
}

export function buildQueryLaneInput(query: string, lane: SearchVectorLane): string {
  const normalized = normalizeSearchText(query);
  if (!normalized) return "";
  if (lane === "mood" || lane === "useCase") return normalized;
  return normalized;
}

export function buildSearchText(family: FontFamilyDoc): string {
  return buildLaneEmbeddingText(family, "text");
}

export function buildSearchTokens(family: FontFamilyDoc): string[] {
  const e = enrichmentFor(family);
  const aliases = Array.isArray(family.canonicalMerge?.aliases) ? family.canonicalMerge.aliases : [];
  return tokenizeSearchText([
    family.id,
    family.slug,
    family.name,
    family.fileBase,
    ...aliases,
    family.category,
    family.classification,
    family.foundry,
    family.designer,
    e?.category,
    e?.classification,
    e?.summary,
    e?.voice,
    ...(e?.moods ?? []),
    ...(e?.useCases ?? []),
    ...(e?.pairingHints ?? []),
    ...(family.subsets ?? []),
    ...(family.axes ?? []).flatMap((axis) => [axis.tag, axis.name]),
    ...(family.faces ?? []).flatMap((face) => [face.styleName, face.weightName, face.fullName, face.postScriptName]),
  ]);
}
