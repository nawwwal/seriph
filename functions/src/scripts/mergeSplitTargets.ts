import { familyFileBase, resolveCanonicalFontIdentity } from "../storage/canonicalize";
import { catalogFamilyDocId } from "../storage/catalogIdentity";
import type { FontFamilyDoc } from "../models/catalog.models";
import type { MergeTarget } from "./mergeSplitFamiliesTypes";

export function targetFor(
  targets: Map<string, MergeTarget>,
  source: FontFamilyDoc,
  identity: ReturnType<typeof resolveCanonicalFontIdentity>
): MergeTarget {
  const docId = catalogFamilyDocId(source.ownerId, identity.slug);
  const existing = targets.get(docId);
  const isCanonicalSource = source.slug === identity.slug || source.id === docId;
  if (existing) {
    if (isCanonicalSource && !existing.base) {
      existing.base = source;
      existing.ownerId = source.ownerId;
      existing.category = source.category;
    }
    return existing;
  }

  const target: MergeTarget = {
    docId,
    slug: identity.slug,
    name: identity.familyName,
    fileBase: identity.fileBase || familyFileBase(identity.familyName),
    ownerId: source.ownerId,
    category: source.category,
    sourceSlugs: [],
    aliases: [],
    aliasDocIds: [],
    faces: [],
    base: isCanonicalSource ? source : undefined,
  };
  targets.set(docId, target);
  return target;
}
