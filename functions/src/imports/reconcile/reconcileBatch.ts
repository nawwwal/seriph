import { getStorage } from "firebase-admin/storage";
import type { DocumentReference, Firestore } from "firebase-admin/firestore";
import { deriveBatchOutcome } from "../state/deriveBatchOutcome";
import type { ImportBatchCounters, BatchTerminalSummary } from "../contracts/batch";
import { importBatchRef } from "../store/paths";
import { rebuildCatalogSummary } from "../../storage/catalogSummary";
import type { ImportTaskPayload } from "../tasks/enqueue";

export type BatchRef = Pick<DocumentReference, "path">;
export type TerminalRecord = Record<string, unknown>;
export interface CleanupResult { path: string; kind: "deleted" | "missing" | "failed"; error?: string }
export interface ReconcileBatchDependencies {
  listSources(ref: BatchRef): Promise<readonly TerminalRecord[]>;
  listItems(ref: BatchRef): Promise<readonly TerminalRecord[]>;
  listPlans(ref: BatchRef): Promise<readonly TerminalRecord[]>;
  listMutations(ref: BatchRef): Promise<readonly TerminalRecord[]>;
  listEnrichments(ref: BatchRef): Promise<readonly TerminalRecord[]>;
  writeBatch(ref: BatchRef, update: Record<string, unknown>): Promise<void>;
  rebuildSummary(ownerId: string, batchId: string): Promise<void>;
  deleteContainers?(ref: BatchRef, paths: readonly string[]): Promise<readonly CleanupResult[]>;
}
export interface ReconcileBatchResult {
  outcome: ReturnType<typeof deriveBatchOutcome>; counters: ImportBatchCounters;
  terminalSummary: BatchTerminalSummary; cataloguedFamilies: number; reviewItems: number;
  warnings: readonly unknown[]; failures: readonly unknown[]; audit: ReconcileAudit; cleanup?: readonly CleanupResult[];
}
export interface ReconcileAudit { nonterminalItems: number; claimCatalogueMismatches: number; missingPublicObjects: number; summaryCountMismatches: number; orphanCandidates: readonly string[] }

const value = (row: TerminalRecord): string => String(row.status ?? row.state ?? "");
const itemTerminal = (row: TerminalRecord): boolean => new Set(["classified", "applied", "duplicate", "review", "discarded", "failed"]).has(value(row));
const sourceTerminal = (row: TerminalRecord): boolean => new Set(["discovered", "failed", "canceled", "timed_out"]).has(value(row));
const planTerminal = (row: TerminalRecord): boolean => new Set(["applied", "partial", "failed"]).has(value(row));
const enrichmentTerminal = (row: TerminalRecord): boolean => new Set(["complete", "failed", "skipped_disabled"]).has(value(row));
const list = (row: TerminalRecord, key: string): unknown[] => Array.isArray(row[key]) ? row[key] as unknown[] : [];
const issue = (rows: readonly TerminalRecord[], key: string): unknown[] => rows.flatMap((row) => list(row, key));
const ids = (rows: readonly TerminalRecord[], key: string): Set<string> => new Set(rows.flatMap((row) => {
  const candidate = row[key]; return typeof candidate === "string" ? [candidate] : [];
}));
function ownerBatch(ref: BatchRef): { ownerId: string; batchId: string } {
  const parts = ref.path.split("/");
  if (parts.length < 4 || parts[0] !== "users" || parts[2] !== "importBatches") throw new Error("invalid import batch reference");
  return { ownerId: parts[1]!, batchId: parts[3]! };
}
function verifiedPath(path: unknown, ownerId: string, batchId: string): path is string {
  return typeof path === "string" && (path.startsWith(`intake/${ownerId}/${batchId}/`) || path.startsWith(`import_staging/${ownerId}/${batchId}/`));
}
function appliedFamilies(plans: readonly TerminalRecord[], mutations: readonly TerminalRecord[]): Set<string> {
  const result = ids(mutations.filter((row) => ["committed", "applied"].includes(value(row))), "familyId");
  plans.filter((row) => value(row) === "applied").forEach((row) => list(row, "familyIds").forEach((id) => { if (typeof id === "string") result.add(id); }));
  return result;
}
const coalesced = new Map<string, Promise<void>>();
async function rebuildOnce(key: string, work: () => Promise<void>): Promise<void> {
  const prior = coalesced.get(key); if (prior) return prior;
  let current!: Promise<void>;
  current = work().finally(() => { if (coalesced.get(key) === current) coalesced.delete(key); });
  coalesced.set(key, current); return current;
}

export async function reconcileBatch(ref: BatchRef, deps: ReconcileBatchDependencies): Promise<ReconcileBatchResult> {
  const { ownerId, batchId } = ownerBatch(ref);
  const [sources, items, plans, mutations, enrichments] = await Promise.all([
    deps.listSources(ref), deps.listItems(ref), deps.listPlans(ref), deps.listMutations(ref), deps.listEnrichments(ref),
  ]);
  const families = appliedFamilies(plans, mutations);
  const reviewIds = new Set(items.filter((row) => value(row) === "review").map((row, index) => typeof row.itemId === "string" ? row.itemId : `item:${index}`));
  plans.flatMap((row) => list(row, "reviewItems")).forEach((review, index) => reviewIds.add(typeof review === "object" && review !== null && typeof (review as TerminalRecord).itemId === "string" ? (review as TerminalRecord).itemId as string : `plan-review:${index}`));
  const reviewItems = reviewIds.size;
  const warnings = [...issue([...sources, ...items, ...plans, ...mutations, ...enrichments], "warnings"), ...issue([...sources, ...items, ...plans, ...mutations, ...enrichments], "warning")];
  const failures = [...issue([...sources, ...items, ...plans, ...mutations, ...enrichments], "failures"), ...issue([...sources, ...items, ...plans, ...mutations, ...enrichments], "error")];
  const duplicateCount = items.filter((row) => ["duplicate", "deduplicate"].includes(value(row))).length;
  const canceled = [...sources, ...items, ...plans, ...mutations, ...enrichments].filter((row) => value(row) === "canceled").length;
  const failed = [...sources, ...items, ...plans, ...mutations, ...enrichments].filter((row) => value(row) === "failed" || row.error !== undefined).length;
  const nonterminal = sources.filter((row) => !sourceTerminal(row)).length + items.filter((row) => !itemTerminal(row)).length + plans.filter((row) => !planTerminal(row)).length + enrichments.filter((row) => !enrichmentTerminal(row)).length;
  const audit: ReconcileAudit = { nonterminalItems: items.filter((row) => !itemTerminal(row)).length, claimCatalogueMismatches: items.filter((row) => row.claimStatus !== undefined && row.catalogued !== undefined && row.claimStatus !== row.catalogued).length, missingPublicObjects: items.filter((row) => row.publicObjectExists === false).length, summaryCountMismatches: items.filter((row) => row.summaryCount !== undefined && row.expectedSummaryCount !== row.summaryCount).length, orphanCandidates: items.flatMap((row) => row.orphanCandidate === true && typeof row.itemId === "string" ? [row.itemId] : []) };
  const terminalSummary = { appliedFamilies: families.size, canceled, duplicates: duplicateCount, failures: failed, nonterminal, review: reviewItems, warnings, failureDetails: failures };
  const outcome = deriveBatchOutcome(terminalSummary);
  const counters: ImportBatchCounters = { sources: sources.length, discoveredItems: items.length, fonts: items.filter((row) => row.role === "font" || row.action === "apply").length, families: families.size, duplicates: duplicateCount, review: reviewItems, warnings: warnings.length, failures: failed };
  let cleanup: readonly CleanupResult[] | undefined;
  const allItemsTerminal = items.length > 0 && items.every(itemTerminal) && plans.some((row) => value(row) !== "building");
  if (allItemsTerminal && deps.deleteContainers) {
    const paths = [...new Set([...sources, ...items].flatMap((row) => [row.storagePath, row.stagingPath]).filter((path) => verifiedPath(path, ownerId, batchId)))];
    cleanup = await deps.deleteContainers(ref, paths);
  }
  await deps.writeBatch(ref, { counters, outcome, terminalSummary, terminalIssues: { warnings, failures }, audit, ...(cleanup ? { cleanup } : {}) });
  if (families.size > 0) await rebuildOnce(`${ownerId}/${batchId}`, () => deps.rebuildSummary(ownerId, batchId));
  return { outcome, counters, terminalSummary, cataloguedFamilies: families.size, reviewItems, warnings, failures, audit, ...(cleanup ? { cleanup } : {}) };
}

export function firestoreReconcileDependencies(db: Firestore): ReconcileBatchDependencies {
  const listCollection = async (ref: BatchRef, name: string) => (await (ref as DocumentReference).collection(name).get()).docs.map((doc) => doc.data());
  const bucket = getStorage().bucket();
  return {
    listSources: (ref) => listCollection(ref, "sources"), listItems: (ref) => listCollection(ref, "items"), listPlans: (ref) => listCollection(ref, "plans"),
    listMutations: (ref) => listCollection(ref, "mutations"), listEnrichments: (ref) => listCollection(ref, "enrichments"),
    writeBatch: async (ref, update) => { await (ref as DocumentReference).set(update, { merge: true }); },
    rebuildSummary: (ownerId, batchId) => rebuildCatalogSummary(db, ownerId, `import-batch:${ownerId}:${batchId}`),
    deleteContainers: async (_ref, paths) => Promise.all(paths.map(async (path) => { try { await bucket.file(path).delete({ ignoreNotFound: true }); return { path, kind: "deleted" as const }; } catch (error) { return { path, kind: "failed" as const, error: error instanceof Error ? error.message : "delete_failed" }; } })),
  };
}

export async function reconcileBatchTask(payload: ImportTaskPayload, db: Firestore): Promise<{ status: 204 }> {
  await reconcileBatch(importBatchRef(db, payload.ownerId, payload.batchId), firestoreReconcileDependencies(db));
  return { status: 204 };
}
