export { updateCatalogFamily } from "./migrateCatalogRepair";
export {
  buildLegacyEnrichment,
  hasCompletedOldSchemaMigration,
  isCatalogFamilyDoc,
  repairFaceVariableState,
  repairFamilyVariableState,
} from "./migrateLegacyEnrichment";
export { collectLegacyFontSources } from "./migrateLegacySources";
export { migrateLegacyDoc } from "./migrateLegacyDoc";
export { runMigration } from "./migrateOldSchemaRunner";
export { parseMigrationArgs } from "./migrateOldSchemaTypes";
export type { LegacyFontSource, MigrationArgs } from "./migrateOldSchemaTypes";

if (require.main === module) {
  import("./migrateOldSchemaRunner").then(({ runMigration }) => runMigration()).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
