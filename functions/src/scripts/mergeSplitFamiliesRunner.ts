import { getApps } from "firebase-admin/app";
import { buildSplitFamilyMergePlan } from "./mergeSplitFamiliesPlan";
import { parseMergeArgs } from "./mergeSplitFamiliesTypes";
import { applyPlan, listCatalogFamilies } from "./mergeSplitFamiliesStore";
import { reparseOriginalFaces } from "./mergeSplitOriginals";
import { conflictDocIds, conflictFreePlan } from "./mergeSplitPlanConflicts";

function ensureAdminEnvDefaults(): void {
  if (!process.env.GOOGLE_CLOUD_PROJECT && !process.env.FIREBASE_ADMIN_PROJECT_ID) {
    process.env.GOOGLE_CLOUD_PROJECT = "seriph";
  }
}

export async function runMergeSplitFamilies(argv = process.argv.slice(2)): Promise<void> {
  ensureAdminEnvDefaults();
  if (!getApps().length) await import("../bootstrap/adminApp");
  const args = parseMergeArgs(argv);
  const storedFamilies = await listCatalogFamilies(args);
  const families = args.reparseOriginals
    ? await reparseOriginalFaces(storedFamilies, { concurrency: args.reparseConcurrency })
    : storedFamilies;
  const plan = buildSplitFamilyMergePlan(families);
  const safePlan = args.skipConflicts ? conflictFreePlan(plan) : plan;
  const skippedConflictDocIds = args.skipConflicts ? conflictDocIds(plan).size : 0;
  const summary = {
    scanned: families.length,
    targets: plan.targets.length,
    aliases: plan.aliases.length,
    conflicts: plan.conflicts.length,
    applyTargets: safePlan.targets.length,
    applyAliases: safePlan.aliases.length,
    skippedConflictDocIds,
    apply: args.apply,
    skipConflicts: args.skipConflicts,
    reparseOriginals: args.reparseOriginals,
    reparseConcurrency: args.reparseConcurrency,
    batchWrites: args.batchWrites,
  };
  console.log(JSON.stringify(summary, null, 2));
  for (const target of plan.targets.filter((item) => item.aliases.length > 0).slice(0, 50)) {
    console.log(`${args.apply ? "merge" : "would merge"} ${target.aliases.join(", ")} -> ${target.slug} (${target.faces.length} faces)`);
  }
  if (plan.conflicts.length) {
    console.error(JSON.stringify({ conflicts: plan.conflicts.slice(0, 50) }, null, 2));
  }
  if (args.apply) await applyPlan(safePlan, args.force, { maxBatchWrites: args.batchWrites });
  if (plan.conflicts.length && !args.force && !args.skipConflicts) process.exitCode = 1;
}
