import { FieldValue, getFirestore, type Firestore } from "firebase-admin/firestore";
import { getApps } from "firebase-admin/app";
import { HISTORICAL_IMPORT_MIGRATION, parseHistoricalMigrationArgs, planHistoricalImportMigration, type HistoricalBatchPlan, type HistoricalIngestRecord } from "./migrateHistoricalImportsPlanner";

export { HISTORICAL_IMPORT_MIGRATION, parseHistoricalMigrationArgs, planHistoricalImportMigration } from "./migrateHistoricalImportsPlanner";
export type { HistoricalBatchPlan, HistoricalIngestRecord, HistoricalMigrationArgs } from "./migrateHistoricalImportsPlanner";

function ownerAndId(path: string): { ownerId: string; ingestId: string } | null {
  const parts = path.split("/");
  return parts.length === 4 && parts[0] === "users" && parts[2] === "ingests" ? { ownerId: parts[1]!, ingestId: parts[3]! } : null;
}

function recordFromSnapshot(snapshot: { ref: { path: string }; data: () => Record<string, unknown> }): HistoricalIngestRecord | null {
  const identity = ownerAndId(snapshot.ref.path); if (!identity) return null;
  const data = snapshot.data(); const value = (key: string): unknown => data[key];
  const stringValue = (key: string): string | undefined => typeof value(key) === "string" ? value(key) as string : undefined;
  const numberValue = (key: string): number | undefined => typeof value(key) === "number" ? value(key) as number : undefined;
  return { ...identity, firestorePath: snapshot.ref.path, batchId: stringValue("batchId"), originalName: stringValue("originalName"), relPath: stringValue("relPath"), status: stringValue("status"), analysisState: stringValue("analysisState"), contentHash: stringValue("contentHash"), familyId: stringValue("familyId"), declaredSize: numberValue("size"), declaredMimeType: stringValue("mimeType") };
}

async function listRecords(db: Firestore, ownerId: string | undefined, limit: number | undefined, allOwners: boolean): Promise<HistoricalIngestRecord[]> {
  if (!ownerId && !allOwners) throw new Error("Pass --ownerId=<uid> or --allOwners; dry run is still the default.");
  const query = ownerId ? db.collection("users").doc(ownerId).collection("ingests") : db.collectionGroup("ingests");
  const snapshots = (await query.get()).docs.map((snapshot) => recordFromSnapshot(snapshot)).filter((record): record is HistoricalIngestRecord => Boolean(record));
  return snapshots.sort((a, b) => a.firestorePath.localeCompare(b.firestorePath)).slice(0, limit);
}

async function writePlan(db: Firestore, plan: HistoricalBatchPlan): Promise<"created" | "already_complete"> {
  const root = db.collection("users").doc(String(plan.batch.ownerId)).collection("importBatches").doc(String(plan.batch.batchId));
  const existing = await root.get(); const migration = existing.data()?.migration as { version?: string; status?: string } | undefined;
  const ownMigration = existing.data()?.historyOnly === true && migration?.version === HISTORICAL_IMPORT_MIGRATION;
  if (existing.exists && !ownMigration) throw new Error(`refusing to overwrite ${root.path}`);
  if (migration?.status === "complete") return "already_complete";
  const now = FieldValue.serverTimestamp(); const base = { ...plan.batch, createdAt: now, updatedAt: now, migration: { ...plan.batch.migration as object, version: HISTORICAL_IMPORT_MIGRATION, status: "writing" }, phases: Object.fromEntries(Object.entries(plan.batch.phases as Record<string, Record<string, unknown>>).map(([key, phase]) => [key, { ...phase, updatedAt: now }])) };
  await root.set(base, { merge: true });
  for (let index = 0; index < plan.sources.length; index += 450) {
    const write = db.batch(); plan.sources.slice(index, index + 450).forEach((source) => write.set(root.collection("sources").doc(String(source.sourceId)), { ...source, createdAt: now, updatedAt: now })); await write.commit();
  }
  await root.set({ migration: { ...plan.batch.migration as object, version: HISTORICAL_IMPORT_MIGRATION, status: "complete", completedAt: now }, updatedAt: now }, { merge: true });
  return "created";
}

export async function runHistoricalImportMigration(argv = process.argv.slice(2)): Promise<void> {
  if (!getApps().length) await import("../bootstrap/adminApp");
  const args = parseHistoricalMigrationArgs(argv); const records = await listRecords(getFirestore(), args.ownerId, args.limit, args.allOwners); const plans = planHistoricalImportMigration(records);
  const summary = { migration: HISTORICAL_IMPORT_MIGRATION, dryRun: args.dryRun, scanned: records.length, plannedBatches: plans.length, plannedSources: plans.reduce((sum, plan) => sum + plan.sources.length, 0), created: 0, alreadyComplete: 0 };
  if (!args.dryRun) for (const plan of plans) { if (await writePlan(getFirestore(), plan) === "created") summary.created += 1; else summary.alreadyComplete += 1; }
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) runHistoricalImportMigration().catch((error) => { console.error(error); process.exitCode = 1; });
