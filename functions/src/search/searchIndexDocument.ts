import type { FontFamilyDoc, SearchMeta } from "../models/catalog.models";
import { buildSearchText, buildSearchTokens } from "./searchLaneText";
import type { SearchVersionInfo } from "./searchDocumentTypes";

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
    family.searchIndexState === "ready" &&
    Boolean(family.searchText) &&
    Boolean(family.searchTokens?.length) &&
    family.searchMeta?.embeddingVersion === version.embeddingVersion &&
    family.searchMeta?.promptVersion === version.promptVersion &&
    family.text_vec !== undefined &&
    family.mood_vec !== undefined &&
    family.use_case_vec !== undefined
  );
}
