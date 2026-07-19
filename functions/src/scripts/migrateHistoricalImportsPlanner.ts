import { createHash } from "node:crypto";

export const HISTORICAL_IMPORT_MIGRATION = "2026-07-history-only-v1";
const hash = (value: string): string => createHash("sha256").update(value).digest("hex").slice(0, 24);
const text = (value: unknown): string | undefined => typeof value === "string" && value.trim() ? value.trim() : undefined;
const safeSize = (value: unknown): number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
const extension = (name: string): string => name.split(".").pop()?.toLowerCase() ?? "";
const mime = (name: string): string => ({ otf: "font/otf", ttf: "font/ttf", woff: "font/woff", woff2: "font/woff2", zip: "application/zip" }[extension(name)] ?? "application/octet-stream");
const failed = (record: HistoricalIngestRecord): boolean => [record.status, record.analysisState].some((value) => ["failed", "error", "quarantined"].includes(value?.toLowerCase() ?? ""));
const needsReview = (record: HistoricalIngestRecord): boolean => !failed(record) && !["completed", "complete", "finalized", "file_moved"].includes(record.status?.toLowerCase() ?? "") && record.analysisState?.toLowerCase() !== "complete";

export interface HistoricalIngestRecord {
  firestorePath: string;
  ownerId: string;
  ingestId: string;
  batchId?: string;
  originalName?: string;
  relPath?: string;
  status?: string;
  analysisState?: string;
  contentHash?: string;
  familyId?: string;
  declaredSize?: number;
  declaredMimeType?: string;
}

export interface HistoricalBatchPlan {
  batch: Record<string, unknown>;
  sources: Record<string, unknown>[];
}

function sourceFor(record: HistoricalIngestRecord, batchId: string): Record<string, unknown> {
  const filename = text(record.originalName) ?? `historical-${record.ingestId}`;
  return {
    sourceId: `legacy-${hash(record.firestorePath)}`, ownerId: record.ownerId, batchId,
    originalPath: text(record.relPath) ?? filename, filename, declaredSize: safeSize(record.declaredSize),
    declaredMimeType: text(record.declaredMimeType) ?? mime(filename), storagePath: "",
    uploadConfirmed: false, state: "discovered", retryCount: 0, historyOnly: true,
    legacyHistory: { migration: HISTORICAL_IMPORT_MIGRATION, firestorePath: record.firestorePath,
      ingestId: record.ingestId, status: record.status ?? null, analysisState: record.analysisState ?? null,
      contentHash: record.contentHash ?? null, familyId: record.familyId ?? null },
  };
}

export function planHistoricalImportMigration(records: readonly HistoricalIngestRecord[]): HistoricalBatchPlan[] {
  const groups = new Map<string, HistoricalIngestRecord[]>();
  [...records].sort((a, b) => a.firestorePath.localeCompare(b.firestorePath)).forEach((record) => {
    const key = `${record.ownerId}\0${text(record.batchId) ?? record.firestorePath}`;
    groups.set(key, [...(groups.get(key) ?? []), record]);
  });
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, group]) => {
    const ownerId = group[0]!.ownerId; const sourceBatch = text(group[0]!.batchId);
    const batchId = `legacy-${hash(`${HISTORICAL_IMPORT_MIGRATION}\0${key}`)}`;
    const failures = group.filter(failed).length; const reviews = group.filter(needsReview).length;
    const outcome = failures ? "failed" : reviews ? "needs_review" : "succeeded";
    return { batch: { batchId, schemaVersion: 1, ownerId, label: sourceBatch ? `Historical import ${sourceBatch}` : "Historical import", sealed: true, expectedSourceCount: group.length, planVersion: 0, historyOnly: true, migration: { version: HISTORICAL_IMPORT_MIGRATION, source: "users/{ownerId}/ingests", status: "planned", legacyBatchId: sourceBatch ?? null }, phases: { upload: { state: "discovered", attempts: 0 }, planning: { state: "applied", attempts: 0 }, enrichment: { state: "skipped_disabled", attempts: 0 } }, counters: { sources: group.length, discoveredItems: 0, fonts: 0, families: 0, duplicates: 0, review: reviews, warnings: reviews, failures }, terminalSummary: { appliedFamilies: 0, canceled: 0, duplicates: 0, failures, nonterminal: 0, review: reviews }, outcome }, sources: group.map((record) => sourceFor(record, batchId)) };
  });
}

export interface HistoricalMigrationArgs { ownerId?: string; allOwners: boolean; limit?: number; dryRun: boolean; }

export function parseHistoricalMigrationArgs(argv: readonly string[]): HistoricalMigrationArgs {
  const args: HistoricalMigrationArgs = { allOwners: false, dryRun: true };
  argv.forEach((arg) => {
    if (arg === "--apply") args.dryRun = false;
    else if (arg === "--dryRun" || arg === "--dry-run") args.dryRun = true;
    else if (arg === "--allOwners") args.allOwners = true;
    else if (arg.startsWith("--ownerId=")) args.ownerId = text(arg.slice("--ownerId=".length));
    else if (arg.startsWith("--limit=")) { const value = Number(arg.slice("--limit=".length)); if (Number.isSafeInteger(value) && value > 0) args.limit = value; }
  });
  return args;
}
