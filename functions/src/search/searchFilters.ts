import { FieldPath, type Query } from "firebase-admin/firestore";
import type { FontFamilyDoc } from "../models/catalog.models";
import type { SearchRequest } from "./searchTypes";

export function isVariableFamily(family: FontFamilyDoc): boolean {
  return family.faces?.some((face) => face.isVariable) ?? false;
}

export function isAliasFamily(family: FontFamilyDoc): boolean {
  return family.status === "merged" || family.hidden === true || Boolean(family.mergedInto || family.aliasOf);
}

export function isSearchableStatus(family: FontFamilyDoc): boolean {
  return !isAliasFamily(family) && (family.status === "ready" || family.status === "enriched");
}

export function matchesSearchFilters(family: FontFamilyDoc, req: SearchRequest): boolean {
  return isSearchableStatus(family)
    && (req.filters?.isVariable === undefined || isVariableFamily(family) === req.filters.isVariable);
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
