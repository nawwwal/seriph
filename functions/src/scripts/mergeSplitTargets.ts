import { familyFileBase, resolveCanonicalFontIdentity } from "../storage/canonicalize";
import { catalogFamilyDocId } from "../storage/catalogIdentity";
import type { FontFamilyDoc } from "../models/catalog.models";
import type { MergeTarget } from "./mergeSplitFamiliesTypes";

export function targetFor(
  targets: Map<string, MergeTarget>,
  source: FontFamilyDoc,
  identity: ReturnType<typeof resolveCanonicalFontIdentity>
): MergeTarget {
  const canonicalDocId = catalogFamilyDocId(source.ownerId, identity.slug);
  const isCanonicalSource = source.slug === identity.slug || source.id === canonicalDocId;
  const existing = targets.get(canonicalDocId);
  if (existing) {
    if (isCanonicalSource && !existing.base) {
      existing.base = source;
      existing.ownerId = source.ownerId;
      existing.category = source.category;
    }
    return existing;
  }

  const target: MergeTarget = {
    docId: canonicalDocId,
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
  targets.set(canonicalDocId, target);
  return target;
}
