import { getStorage } from "firebase-admin/storage";
import type { DocumentReference, Firestore } from "firebase-admin/firestore";
import { deriveBatchOutcome } from "../state/deriveBatchOutcome";
import type { ImportBatchCounters, BatchTerminalSummary } from "../contracts/batch";
import { importBatchRef } from "../store/paths";
import { rebuildCatalogSummary } from "../../storage/catalogSummary";
import { AggregateReadOverflowError, readQueryPages } from "../../storage/paginatedRead";
import type { ImportTaskPayload } from "../tasks/enqueue";
import { isImportBatchCanceled } from "../tasks/cancellation";
import { appliedFamilies, enrichmentTerminal, issue, itemTerminal, list, mutationTerminal, ownerBatch, overflowReview, planTerminal, rebuildOnce, rowValue, sourceTerminal, verifiedPath } from "./reconcileBatchSupport";
import { ENRICHMENT_JOBS_COLLECTION } from "../../enrichment/jobs/jobStore";

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
export interface ReconcileAudit { nonterminalItems: number; claimCatalogueMismatches: number; missingPublicObjects: number; summaryCountMismatches: number; orphanCandidates: readonly string[]; aggregateReadOverflow?: string }

function enrichmentPhase(rows: readonly TerminalRecord[]): string {
  if (rows.some((row) => rowValue(row) === "failed")) return "failed";
  if (rows.length && rows.every((row) => rowValue(row) === "complete")) return "complete";
  if (rows.length && rows.every((row) => rowValue(row) === "skipped_disabled")) return "skipped_disabled";
  return rows.length ? rowValue(rows[0]!) || "queued" : "blocked";
}

export async function reconcileBatch(ref: BatchRef, deps: ReconcileBatchDependencies): Promise<ReconcileBatchResult> {
  const { ownerId, batchId } = ownerBatch(ref);
  let sources: readonly TerminalRecord[]; let items: readonly TerminalRecord[]; let plans: readonly TerminalRecord[];
  let mutations: readonly TerminalRecord[]; let enrichments: readonly TerminalRecord[];
  try {
    [sources, items, plans, mutations, enrichments] = await Promise.all([
      deps.listSources(ref), deps.listItems(ref), deps.listPlans(ref), deps.listMutations(ref), deps.listEnrichments(ref),
    ]);
  } catch (error) {
    if (error instanceof AggregateReadOverflowError) return overflowReview(ref, deps, error);
    throw error;
  }
  const batchData = typeof (ref as DocumentReference).get === "function" ? (await (ref as DocumentReference).get()).data() as TerminalRecord | undefined : undefined;
  const planningFailure = (batchData?.phases as TerminalRecord | undefined)?.planning as TerminalRecord | undefined;
  const planningFailed = planningFailure?.state === "failed";
  const families = appliedFamilies(plans, mutations);
  const reviewIds = new Set(items.filter((row) => rowValue(row) === "review").map((row, index) => typeof row.itemId === "string" ? row.itemId : `item:${index}`));
  plans.flatMap((row) => list(row, "reviewItems")).forEach((review, index) => reviewIds.add(typeof review === "object" && review !== null && typeof (review as TerminalRecord).itemId === "string" ? (review as TerminalRecord).itemId as string : `plan-review:${index}`));
  const reviewItems = reviewIds.size;
  const warnings = [...issue([...sources, ...items, ...plans, ...mutations, ...enrichments], "warnings"), ...issue([...sources, ...items, ...plans, ...mutations, ...enrichments], "warning")];
  const failures = [...issue([...sources, ...items, ...plans, ...mutations, ...enrichments], "failures"), ...issue([...sources, ...items, ...plans, ...mutations, ...enrichments], "error"), ...(planningFailed ? [planningFailure?.error ?? { code: "planning_failed" }] : [])];
  const duplicateCount = items.filter((row) => ["duplicate", "deduplicate"].includes(rowValue(row))).length;
  const canceled = [...sources, ...items, ...plans, ...mutations, ...enrichments].filter((row) => rowValue(row) === "canceled").length;
  const failed = [...sources, ...items, ...plans, ...mutations, ...enrichments].filter((row) => ["failed", "timed_out", "stalled"].includes(rowValue(row)) || row.error !== undefined).length + Number(planningFailed);
  const nonterminal = sources.filter((row) => !sourceTerminal(row)).length + items.filter((row) => !itemTerminal(row)).length + plans.filter((row) => !planTerminal(row)).length + mutations.filter((row) => !mutationTerminal(row)).length + enrichments.filter((row) => !enrichmentTerminal(row)).length;
  const audit: ReconcileAudit = { nonterminalItems: items.filter((row) => !itemTerminal(row)).length, claimCatalogueMismatches: items.filter((row) => row.claimStatus !== undefined && row.catalogued !== undefined && row.claimStatus !== row.catalogued).length, missingPublicObjects: items.filter((row) => row.publicObjectExists === false).length, summaryCountMismatches: items.filter((row) => row.summaryCount !== undefined && row.expectedSummaryCount !== row.summaryCount).length, orphanCandidates: items.flatMap((row) => row.orphanCandidate === true && typeof row.itemId === "string" ? [row.itemId] : []) };
  const terminalSummary = { appliedFamilies: families.size, canceled, duplicates: duplicateCount, failures: failed, nonterminal, review: reviewItems, warnings, failureDetails: failures };
  const outcome = deriveBatchOutcome(terminalSummary);
  const counters: ImportBatchCounters = { sources: sources.length, discoveredItems: items.length, fonts: items.filter((row) => row.role === "font" || row.action === "apply").length, families: families.size, duplicates: duplicateCount, review: reviewItems, warnings: warnings.length, failures: failed };
  let cleanup: readonly CleanupResult[] | undefined;
  const allLifecycleRowsTerminal = items.length > 0 && sources.every(sourceTerminal) && items.every(itemTerminal) && plans.length > 0 && plans.every(planTerminal) && mutations.every(mutationTerminal) && enrichments.every(enrichmentTerminal);
  if (allLifecycleRowsTerminal && deps.deleteContainers) {
    const paths = [...new Set([...sources, ...items].flatMap((row) => [row.storagePath, row.stagingPath]).filter((path) => verifiedPath(path, ownerId, batchId)))];
    cleanup = await deps.deleteContainers(ref, paths);
  }
  const invalidationToken = families.size > 0 ? `import-batch:${ownerId}:${batchId}` : undefined;
  const priorPhases = (batchData?.phases as TerminalRecord | undefined) ?? {};
  const phases = { ...priorPhases, enrichment: { state: enrichmentPhase(enrichments), updatedAt: new Date() } };
  await deps.writeBatch(ref, { counters, outcome, phases, terminalSummary, terminalIssues: { warnings, failures }, audit, ...(invalidationToken ? { catalogSummaryInvalidationToken: invalidationToken } : {}), ...(cleanup ? { cleanup } : {}) });
  if (families.size > 0) await rebuildOnce(`${ownerId}/${batchId}`, () => deps.rebuildSummary(ownerId, batchId));
  return { outcome, counters, terminalSummary, cataloguedFamilies: families.size, reviewItems, warnings, failures, audit, ...(cleanup ? { cleanup } : {}) };
}

export function firestoreReconcileDependencies(db: Firestore): ReconcileBatchDependencies {
  const listCollection = async (ref: BatchRef, name: string) => (await readQueryPages((ref as DocumentReference).collection(name), name)).map((doc) => doc.data());
  const bucket = getStorage().bucket();
  return {
    listSources: (ref) => listCollection(ref, "sources"), listItems: (ref) => listCollection(ref, "items"), listPlans: (ref) => listCollection(ref, "plans"),
    listMutations: (ref) => listCollection(ref, "mutations"),
    listEnrichments: async (ref) => {
      const { ownerId, batchId } = ownerBatch(ref);
      const rows = await readQueryPages(db.collection(ENRICHMENT_JOBS_COLLECTION).where("batchId", "==", batchId), ENRICHMENT_JOBS_COLLECTION);
      return rows.map((doc) => doc.data()).filter((row) => row.ownerId === ownerId);
    },
    writeBatch: async (ref, update) => { await (ref as DocumentReference).set(update, { merge: true }); },
    rebuildSummary: (ownerId, batchId) => rebuildCatalogSummary(db, ownerId, `import-batch:${ownerId}:${batchId}`),
    deleteContainers: async (_ref, paths) => Promise.all(paths.map(async (path) => { try { await bucket.file(path).delete({ ignoreNotFound: true }); return { path, kind: "deleted" as const }; } catch (error) { return { path, kind: "failed" as const, error: error instanceof Error ? error.message : "delete_failed" }; } })),
  };
}

export async function reconcileBatchTask(payload: ImportTaskPayload, db: Firestore): Promise<{ status: 204 }> {
  if (await isImportBatchCanceled(db, payload.ownerId, payload.batchId)) return { status: 204 };
  const batch = await importBatchRef(db, payload.ownerId, payload.batchId).get();
  if (batch.data()?.status === "stalled") return { status: 204 };
  await reconcileBatch(importBatchRef(db, payload.ownerId, payload.batchId), firestoreReconcileDependencies(db));
  return { status: 204 };
}
