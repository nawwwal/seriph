import { catalogFamilyDocId } from "./catalogIdentity";
import type { FontFamilyDoc } from "../models/catalog.models";

export function isAliasFamilyDoc(family: Partial<FontFamilyDoc>): boolean {
  return family.status === "merged" || family.hidden === true || Boolean(family.mergedInto || family.aliasOf || family.mergedIntoId || family.aliasOfId);
}

export function aliasTargetDocId(family: Partial<FontFamilyDoc>): string | null {
  if (typeof family.mergedIntoId === "string" && family.mergedIntoId.trim()) return family.mergedIntoId;
  if (typeof family.aliasOfId === "string" && family.aliasOfId.trim()) return family.aliasOfId;
  const targetSlug = typeof family.mergedInto === "string" ? family.mergedInto : family.aliasOf;
  return targetSlug ? catalogFamilyDocId(family.ownerId, targetSlug) : null;
}
