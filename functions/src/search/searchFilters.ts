import { FieldPath, type Query } from "firebase-admin/firestore";
import type { FontFamilyDoc } from "../models/catalog.models";
import { canonicalSearchClassification } from "./searchClassification";
import type { SearchRequest } from "./searchTypes";

type SearchStyleRange = NonNullable<NonNullable<SearchRequest["filters"]>["styleRanges"]>[number];

export function isVariableFamily(family: FontFamilyDoc): boolean {
  return family.faces?.some((face) => face.isVariable) ?? false;
}

export function isAliasFamily(family: FontFamilyDoc): boolean {
  return family.status === "merged" || family.hidden === true || Boolean(family.mergedInto || family.aliasOf);
}

export function isSearchableStatus(family: FontFamilyDoc): boolean {
  return !isAliasFamily(family) && (family.status === "ready" || family.status === "enriched");
}

function variableFilter(req: SearchRequest): boolean | undefined {
  if (typeof req.filters?.isVariable === "boolean") return req.filters.isVariable;
  if (req.filters?.variable === "variable") return true;
  if (req.filters?.variable === "static") return false;
  return undefined;
}

function inStyleRanges(count: number, ranges: SearchStyleRange[] | undefined): boolean {
  if (!Array.isArray(ranges) || ranges.length === 0) return true;
  return ranges.some((range) => {
    if (range === "1") return count === 1;
    if (range === "2-4") return count >= 2 && count <= 4;
    if (range === "5-8") return count >= 5 && count <= 8;
    return range === "9+" && count >= 9;
  });
}

export function matchesSearchFilters(family: FontFamilyDoc, req: SearchRequest): boolean {
  const variable = variableFilter(req);
  const classification = canonicalSearchClassification(family.enrichment?.classification) ?? canonicalSearchClassification(family.classification) ?? "";
  const moods = family.enrichment?.moods ?? [];
  return isSearchableStatus(family)
    && (variable === undefined || isVariableFamily(family) === variable)
    && (!req.filters?.classifications?.length || req.filters.classifications.includes(classification))
    && (!req.filters?.moods?.length || req.filters.moods.every((mood) => moods.includes(mood)))
    && inStyleRanges(family.faces?.length ?? 0, req.filters?.styleRanges);
}

export function applyStructuredFilters(query: Query, req: SearchRequest): Query {
  let base = query;
  if (req.filters?.ownerId) base = base.where("ownerId", "==", req.filters.ownerId);
  if (req.filters?.category) base = base.where("category", "==", req.filters.category);
  return base;
}

export async function fetchSearchableListing(base: Query, req: SearchRequest, topK: number): Promise<FontFamilyDoc[]> {
  const batchSize = Math.min(100, Math.max(topK * 2, 24));
  const results: FontFamilyDoc[] = [];
  let cursor: string | null = null;
  let scanned = 0;

  while (results.length < topK && scanned < 1000) {
    let query = base.orderBy(FieldPath.documentId()).limit(batchSize);
    if (cursor) query = query.startAfter(cursor);
    const snap = await query.get();
    if (snap.empty) break;
    scanned += snap.docs.length;
    for (const doc of snap.docs) {
      const family = { ...doc.data(), id: doc.id } as FontFamilyDoc;
      if (matchesSearchFilters(family, req)) results.push(family);
      if (results.length >= topK) break;
    }
    cursor = snap.docs[snap.docs.length - 1]?.id ?? null;
    if (snap.docs.length < batchSize) break;
  }

  return results;
}
