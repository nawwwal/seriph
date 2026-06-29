import { getApps } from "firebase-admin/app";
import { buildSplitFamilyMergePlan } from "./mergeSplitFamiliesPlan";
import { parseMergeArgs } from "./mergeSplitFamiliesTypes";
import { applyPlan, listCatalogFamilies } from "./mergeSplitFamiliesStore";

function ensureAdminEnvDefaults(): void {
  if (!process.env.GOOGLE_CLOUD_PROJECT && !process.env.FIREBASE_ADMIN_PROJECT_ID) {
    process.env.GOOGLE_CLOUD_PROJECT = "seriph";
  }
}

export async function runMergeSplitFamilies(argv = process.argv.slice(2)): Promise<void> {
  ensureAdminEnvDefaults();
  if (!getApps().length) await import("../bootstrap/adminApp");
  const args = parseMergeArgs(argv);
  const families = await listCatalogFamilies(args);
  const plan = buildSplitFamilyMergePlan(families);
  const summary = {
    scanned: families.length,
    targets: plan.targets.length,
    aliases: plan.aliases.length,
    conflicts: plan.conflicts.length,
    apply: args.apply,
  };
  console.log(JSON.stringify(summary, null, 2));
  for (const target of plan.targets.filter((item) => item.aliases.length > 0).slice(0, 50)) {
    console.log(`${args.apply ? "merge" : "would merge"} ${target.aliases.join(", ")} -> ${target.slug} (${target.faces.length} faces)`);
  }
  if (plan.conflicts.length) {
    console.error(JSON.stringify({ conflicts: plan.conflicts.slice(0, 50) }, null, 2));
  }
  if (args.apply) await applyPlan(plan, args.force);
  if (plan.conflicts.length && !args.force) process.exitCode = 1;
}
