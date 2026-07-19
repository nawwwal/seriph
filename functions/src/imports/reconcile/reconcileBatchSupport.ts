import type { BatchRef, ReconcileAudit, ReconcileBatchDependencies, ReconcileBatchResult, TerminalRecord } from "./reconcileBatch";
import type { ImportBatchCounters } from "../contracts/batch";
import { deriveBatchOutcome } from "../state/deriveBatchOutcome";
import { AggregateReadOverflowError } from "../../storage/paginatedRead";

const value = (row: TerminalRecord): string => String(row.status ?? row.state ?? "");
const itemStates = new Set(["classified", "applied", "duplicate", "review", "discarded", "failed"]);
const sourceStates = new Set(["discovered", "failed", "canceled", "timed_out"]);
const planStates = new Set(["applied", "partial", "failed"]);
const mutationStates = new Set(["committed", "applied", "rolled_back", "failed", "canceled", "review"]);
const enrichmentStates = new Set(["complete", "failed", "skipped_disabled"]);
export const itemTerminal = (row: TerminalRecord): boolean => {
  if (!itemStates.has(value(row))) return false;
  const archive = row.archive as TerminalRecord | undefined;
  return !archive || (archive.inventoryDurable === true && Number(archive.terminalChildren) >= Number(archive.expectedChildren) && ["complete", "review"].includes(String(archive.state)));
};
export const sourceTerminal = (row: TerminalRecord): boolean => sourceStates.has(value(row));
export const planTerminal = (row: TerminalRecord): boolean => planStates.has(value(row));
export const mutationTerminal = (row: TerminalRecord): boolean => mutationStates.has(value(row));
export const enrichmentTerminal = (row: TerminalRecord): boolean => enrichmentStates.has(value(row));
export const rowValue = value;
export const list = (row: TerminalRecord, key: string): unknown[] => Array.isArray(row[key]) ? row[key] as unknown[] : [];
export const issue = (rows: readonly TerminalRecord[], key: string): unknown[] => rows.flatMap((row) => list(row, key));
export const ids = (rows: readonly TerminalRecord[], key: string): Set<string> => new Set(rows.flatMap((row) => {
  const candidate = row[key]; return typeof candidate === "string" ? [candidate] : [];
}));
export function ownerBatch(ref: BatchRef): { ownerId: string; batchId: string } {
  const parts = ref.path.split("/");
  if (parts.length < 4 || parts[0] !== "users" || parts[2] !== "importBatches") throw new Error("invalid import batch reference");
  return { ownerId: parts[1]!, batchId: parts[3]! };
}
export function verifiedPath(path: unknown, ownerId: string, batchId: string): path is string {
  return typeof path === "string" && (path.startsWith(`intake/${ownerId}/${batchId}/`) || path.startsWith(`import_staging/${ownerId}/${batchId}/`));
}
export function appliedFamilies(plans: readonly TerminalRecord[], mutations: readonly TerminalRecord[]): Set<string> {
  const result = ids(mutations.filter((row) => ["committed", "applied"].includes(value(row))), "familyId");
  plans.filter((row) => value(row) === "applied").forEach((row) => list(row, "familyIds").forEach((id) => { if (typeof id === "string") result.add(id); }));
  return result;
}
const coalesced = new Map<string, Promise<void>>();
export async function rebuildOnce(key: string, work: () => Promise<void>): Promise<void> {
  const prior = coalesced.get(key); if (prior) return prior;
  let current!: Promise<void>;
  current = work().finally(() => { if (coalesced.get(key) === current) coalesced.delete(key); });
  coalesced.set(key, current); return current;
}

export async function overflowReview(ref: BatchRef, deps: ReconcileBatchDependencies, error: AggregateReadOverflowError): Promise<ReconcileBatchResult> {
  const warning = { code: "aggregate_read_overflow", collection: error.collectionName, maxRows: error.maxRows };
  const warnings = [warning]; const failures: unknown[] = [];
  const terminalSummary = { appliedFamilies: 0, canceled: 0, duplicates: 0, failures: 0, nonterminal: 0, review: 1, warnings, failureDetails: failures };
  const counters: ImportBatchCounters = { sources: 0, discoveredItems: 0, fonts: 0, families: 0, duplicates: 0, review: 1, warnings: 1, failures: 0 };
  const audit: ReconcileAudit = { nonterminalItems: 0, claimCatalogueMismatches: 0, missingPublicObjects: 0, summaryCountMismatches: 0, orphanCandidates: [], aggregateReadOverflow: error.collectionName };
  const outcome = deriveBatchOutcome(terminalSummary);
  await deps.writeBatch(ref, { counters, outcome, terminalSummary, terminalIssues: { warnings, failures }, audit });
  return { outcome, counters, terminalSummary, cataloguedFamilies: 0, reviewItems: 1, warnings, failures, audit };
}
