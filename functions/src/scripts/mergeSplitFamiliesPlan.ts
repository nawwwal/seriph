import { catalogFamilyDocIdFor } from "../storage/catalogIdentity";
import type { FontFamilyDoc } from "../models/catalog.models";
import { addFace, normalizeFace, sortFaces } from "./mergeSplitFaces";
import { targetFor } from "./mergeSplitTargets";
import type { AliasPlan, MergeConflict, MergeTarget, SplitFamilyMergePlan } from "./mergeSplitFamiliesTypes";
import { unique } from "./mergeSplitFamiliesTypes";

function isMergedAlias(family: FontFamilyDoc & Record<string, unknown>): boolean {
  return family.status === "merged" || typeof family.mergedInto === "string" || family.hidden === true;
}

export function buildSplitFamilyMergePlan(families: FontFamilyDoc[]): SplitFamilyMergePlan {
  const targets = new Map<string, MergeTarget>();
  const aliases: AliasPlan[] = [];
  const conflicts: MergeConflict[] = [];

  for (const family of families) {
    if (isMergedAlias(family as FontFamilyDoc & Record<string, unknown>)) continue;
    for (const face of family.faces ?? []) {
      const normalized = normalizeFace(family, face);
      const target = targetFor(targets, family, normalized.identity);
      if (!target.sourceSlugs.includes(family.slug)) target.sourceSlugs.push(family.slug);
      const sourceDocId = catalogFamilyDocIdFor(family);
      if (sourceDocId !== target.docId && !target.aliasDocIds.includes(sourceDocId)) {
        if (family.slug !== target.slug && !target.aliases.includes(family.slug)) target.aliases.push(family.slug);
        target.aliasDocIds.push(sourceDocId);
        aliases.push({
          sourceSlug: family.slug,
          sourceDocId,
          targetSlug: target.slug,
          targetDocId: target.docId,
        });
      }
      addFace(target, normalized.face, family.slug, conflicts);
    }
  }

  return {
    targets: [...targets.values()].map((target) => ({
      ...target,
      sourceSlugs: unique(target.sourceSlugs),
      aliasDocIds: unique(target.aliasDocIds),
      faces: sortFaces(target.faces),
    })),
    aliases,
    conflicts,
  };
}
