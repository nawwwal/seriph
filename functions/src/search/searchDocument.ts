import type { FontEnrichment, FontFamilyDoc, SearchMeta } from "../models/catalog.models";

export type SearchVectorLane = "text" | "mood" | "useCase";

export const SEARCH_VECTOR_LANES: SearchVectorLane[] = ["text", "mood", "useCase"];

export interface SearchVersionInfo {
  embeddingModel?: string;
  embeddingVersion: string;
  promptVersion: string;
}

const MAX_TOKEN_COUNT = 80;

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

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function tokenizeSearchText(parts: Array<string | undefined | null>): string[] {
  const tokens = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    const normalized = normalizeSearchText(part.replace(/_/g, " "));
    for (const token of normalized.split(" ")) {
      if (token.length >= 2) tokens.add(token);
    }
  }
  return [...tokens].slice(0, MAX_TOKEN_COUNT);
}

export function buildLaneEmbeddingText(family: FontFamilyDoc, lane: SearchVectorLane): string {
  const e = enrichmentFor(family);
  const classification = e?.classification ?? family.classification;
  const category = e?.category ?? family.category;
  const shared = cleanParts([family.name, family.fileBase, category, classification, family.foundry, family.designer]);

  if (lane === "mood") {
    return cleanParts([
      ...shared,
      e?.voice,
      e?.moods,
      e?.summary,
    ]).join(". ");
  }

  if (lane === "useCase") {
    return cleanParts([
      family.name,
      category,
      classification,
      e?.useCases,
      e?.pairingHints,
      e?.summary,
    ]).join(". ");
  }

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
  if (lane === "mood") return normalized;
  if (lane === "useCase") return normalized;
  return normalized;
}

export function buildSearchText(family: FontFamilyDoc): string {
  return buildLaneEmbeddingText(family, "text");
}

export function buildSearchTokens(family: FontFamilyDoc): string[] {
  const e = enrichmentFor(family);
  return tokenizeSearchText([
    family.id,
    family.slug,
    family.name,
    family.fileBase,
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

export function buildSearchMeta(version: SearchVersionInfo): SearchMeta {
  return {
    embeddingModel: version.embeddingModel ?? version.embeddingVersion.split(":")[0],
    embeddingVersion: version.embeddingVersion,
    promptVersion: version.promptVersion,
  };
}

export function buildSearchDocument(
  family: FontFamilyDoc,
  version: SearchVersionInfo
): Pick<FontFamilyDoc, "searchText" | "searchTokens" | "searchMeta"> {
  return {
    searchText: buildSearchText(family),
    searchTokens: buildSearchTokens(family),
    searchMeta: buildSearchMeta(version),
  };
}

export function isSearchIndexedAtVersion(family: FontFamilyDoc, version: Omit<SearchVersionInfo, "embeddingModel">): boolean {
  return (
    Boolean(family.searchText) &&
    Boolean(family.searchTokens?.length) &&
    family.searchMeta?.embeddingVersion === version.embeddingVersion &&
    family.searchMeta?.promptVersion === version.promptVersion &&
    family.text_vec !== undefined &&
    family.mood_vec !== undefined &&
    family.use_case_vec !== undefined
  );
}
