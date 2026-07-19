import { FieldValue, type Firestore } from "firebase-admin/firestore";
import type { FontFamilyDoc } from "../../models/catalog.models";
import { applyOutputRow } from "../../ingest/batch/output";
import { parseBatchCatalogKey } from "../../ingest/batch/key";
import { catalogKeyFromOutputRow, textFromOutputRow, type BatchOutputRow } from "../../ingest/batch/outputRows";
import { retryState } from "../jobs/retryPolicy";

export type OutputDisposition = "complete" | "missing" | "malformed" | "duplicate" | "stale" | "hidden" | "failed";
export interface ExpectedOutputJob {
  jobId: string; familyId?: string; familyVersion?: number; promptVersion?: string;
  analysisModel?: string; embeddingVersion?: string; attempt?: number;
}
export interface ProviderOutputRun {
  id?: string; providerRunId?: string; expectedJobIds: readonly string[];
  expectedJobs?: readonly ExpectedOutputJob[]; jobs?: readonly ExpectedOutputJob[];
}
export interface ReconcileOutputDependencies {
  db?: Firestore;
  loadFamily?: (job: ExpectedOutputJob) => Promise<FontFamilyDoc | undefined>;
  apply?: (job: ExpectedOutputJob, row: BatchOutputRow) => Promise<boolean>;
  writeOutcome?: (job: ExpectedOutputJob, disposition: OutputDisposition) => Promise<void>;
}

function runId(run: ProviderOutputRun): string | undefined { return run.id ?? run.providerRunId; }
function jobsFor(run: ProviderOutputRun): ExpectedOutputJob[] {
  const known = run.expectedJobs ?? run.jobs ?? [];
  return run.expectedJobIds.map((jobId) => known.find((job) => job.jobId === jobId) ?? { jobId });
}
function parsedJson(row: BatchOutputRow): boolean {
  const text = textFromOutputRow(row)?.trim();
  if (!text) return false;
  try { const value = JSON.parse(text.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim()); return Boolean(value && typeof value === "object" && !Array.isArray(value)); } catch { return false; }
}
function stale(job: ExpectedOutputJob, key: ReturnType<typeof parseBatchCatalogKey>, run: ProviderOutputRun, family?: FontFamilyDoc): boolean {
  const id = runId(run);
  return Boolean((id && key.providerRunId && key.providerRunId !== id) || (job.familyId && key.familyId !== job.familyId)
    || (job.familyVersion !== undefined && key.familyVersion !== job.familyVersion)
    || (job.promptVersion && key.promptVersion !== job.promptVersion)
    || (job.analysisModel && key.analysisModel !== job.analysisModel)
    || (job.embeddingVersion && key.embeddingVersion !== job.embeddingVersion)
    || (family && id && family.enrichmentJobId && family.enrichmentJobId !== id)
    || (family && job.familyVersion !== undefined && family.version !== job.familyVersion)
    || (family && family.status !== "enriching"));
}
async function familyFor(job: ExpectedOutputJob, deps: ReconcileOutputDependencies): Promise<FontFamilyDoc | undefined> {
  if (deps.loadFamily) return deps.loadFamily(job);
  if (!deps.db || !job.familyId) return undefined;
  const snap = await deps.db.collection("fontfamilies").doc(job.familyId).get();
  return snap.exists ? ({ ...snap.data(), id: snap.id } as FontFamilyDoc) : undefined;
}
async function hydrateJob(job: ExpectedOutputJob, deps: ReconcileOutputDependencies): Promise<ExpectedOutputJob> {
  if (!deps.db || (job.familyId && job.familyVersion !== undefined && job.promptVersion && job.analysisModel && job.embeddingVersion)) return job;
  const snap = await deps.db.collection("enrichmentJobs").doc(job.jobId).get();
  return snap.exists ? ({ ...snap.data(), ...job, jobId: job.jobId } as ExpectedOutputJob) : job;
}
async function persistOutcome(run: ProviderOutputRun, job: ExpectedOutputJob, disposition: OutputDisposition, deps: ReconcileOutputDependencies): Promise<void> {
  if (deps.writeOutcome) { await deps.writeOutcome(job, disposition); return; }
  if (!deps.db) return;
  const ref = deps.db.collection("enrichmentJobs").doc(job.jobId);
  if (disposition === "complete") { await ref.set({ state: "complete", updatedAt: FieldValue.serverTimestamp() }, { merge: true }); return; }
  const prior = await ref.get();
  const attempt = Number(prior.data()?.attempt ?? job.attempt ?? 0);
  const plan = disposition === "hidden" ? { state: "failed" as const, delayMs: null, attempt: attempt + 1 } : retryState(attempt);
  await ref.set({ state: plan.state, attempt: plan.attempt, failureCode: `output_${disposition}`, providerRunId: runId(run),
    ...(plan.delayMs === null ? { failedAt: FieldValue.serverTimestamp() } : { retryAt: new Date(Date.now() + plan.delayMs) }),
    updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

export async function reconcileProviderOutput(
  run: ProviderOutputRun, rows: readonly BatchOutputRow[], deps: ReconcileOutputDependencies = {},
): Promise<{ byJob: Record<string, OutputDisposition> }> {
  const byRow = new Map<string, BatchOutputRow[]>();
  for (const row of rows) {
    const raw = catalogKeyFromOutputRow(row); if (!raw) continue;
    const key = parseBatchCatalogKey(raw); if (key.jobId) byRow.set(key.jobId, [...(byRow.get(key.jobId) ?? []), row]);
  }
  const result: Record<string, OutputDisposition> = {};
  for (const originalJob of jobsFor(run)) {
    const job = await hydrateJob(originalJob, deps);
    const candidates = byRow.get(job.jobId) ?? []; let disposition: OutputDisposition;
    const raw = candidates[0] && catalogKeyFromOutputRow(candidates[0]);
    const key = raw ? parseBatchCatalogKey(raw) : undefined;
    const family = key ? await familyFor(job, deps) : undefined;
    if (!candidates.length) disposition = "missing";
    else if (candidates.length > 1) disposition = "duplicate";
    else if (!key || key.jobId !== job.jobId || !parsedJson(candidates[0])) disposition = "malformed";
    else if (stale(job, key, run, family)) disposition = "stale";
    else if (family && (family.hidden === true || family.status === "merged" || family.mergedInto || family.aliasOf)) disposition = "hidden";
    else {
      try { disposition = await (deps.apply ?? ((_, row) => applyOutputRow(row)))(job, candidates[0]) ? "complete" : "failed"; }
      catch { disposition = "failed"; }
    }
    result[job.jobId] = disposition;
    try { await persistOutcome(run, job, disposition, deps); } catch { /* one outcome must not hide the rest */ }
  }
  return { byJob: result };
}
