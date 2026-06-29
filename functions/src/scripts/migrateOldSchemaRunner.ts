import { getApps } from "firebase-admin/app";
import { repairCatalogDocs } from "./migrateCatalogRepair";
import { migrateLegacyDoc } from "./migrateLegacyDoc";
import { listLegacyDocs } from "./migrateOldSchemaQueries";
import { parseMigrationArgs } from "./migrateOldSchemaTypes";

function ensureAdminEnvDefaults(): void {
  if (!process.env.GOOGLE_CLOUD_PROJECT && !process.env.FIREBASE_ADMIN_PROJECT_ID) {
    process.env.GOOGLE_CLOUD_PROJECT = "seriph";
  }
  if (!process.env.FIREBASE_STORAGE_BUCKET && !process.env.GOOGLE_CLOUD_STORAGE_BUCKET && !process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || "seriph";
    process.env.FIREBASE_STORAGE_BUCKET = `${projectId}.firebasestorage.app`;
  }
}

export async function runMigration(argv = process.argv.slice(2)): Promise<void> {
  ensureAdminEnvDefaults();
  if (!getApps().length) await import("../bootstrap/adminApp");
  const args = parseMigrationArgs(argv);
  const summary = { scanned: 0, migrated: 0, catalogSkipped: 0, skipped: 0, failed: 0, catalogUpdated: 0, dryRun: args.dryRun };
  for (const doc of await listLegacyDocs(args)) {
    summary.scanned += 1;
    try {
      const result = await migrateLegacyDoc(doc, args);
      if (result === "migrated") summary.migrated += 1;
      else if (result === "catalog") summary.catalogSkipped += 1;
      else summary.skipped += 1;
    } catch (error) {
      summary.failed += 1;
      console.error(`failed ${doc.ref.path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  summary.catalogUpdated = await repairCatalogDocs(args);
  console.log(JSON.stringify(summary, null, 2));
  if (summary.failed > 0) process.exitCode = 1;
}
