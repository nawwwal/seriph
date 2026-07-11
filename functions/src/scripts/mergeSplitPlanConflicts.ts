import type { SplitFamilyMergePlan } from "./mergeSplitFamiliesTypes";

function targetDocIds(target: SplitFamilyMergePlan["targets"][number]): string[] {
  return [target.docId, ...target.aliasDocIds];
}

export function conflictDocIds(plan: SplitFamilyMergePlan): Set<string> {
  const conflictedSlugs = new Set(plan.conflicts.map((conflict) => conflict.targetSlug));
  const ids = new Set<string>();
  for (const target of plan.targets) {
    if (!conflictedSlugs.has(target.slug)) continue;
    for (const docId of targetDocIds(target)) ids.add(docId);
  }
  return ids;
}

export function conflictFreePlan(plan: SplitFamilyMergePlan): SplitFamilyMergePlan {
  const skippedDocIds = conflictDocIds(plan);
  if (!skippedDocIds.size) return plan;
  const targets = plan.targets.filter((target) => targetDocIds(target).every((docId) => !skippedDocIds.has(docId)));
  const targetDocIdsToApply = new Set(targets.map((target) => target.docId));
  return {
    targets,
    aliases: plan.aliases.filter((alias) => targetDocIdsToApply.has(alias.targetDocId) && !skippedDocIds.has(alias.sourceDocId)),
    conflicts: [],
  };
}
