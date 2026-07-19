import { preflightFamily } from "../preflight";
import type { FontFamilyDoc } from "../../models/catalog.models";
import type { EnrichmentJob, EnrichmentJobState } from "./jobTypes";

export const ENRICHMENT_COLLECTOR_INTERVAL_MS = 5 * 60 * 1000;

export interface EnrichmentCollectorDependencies {
  enabled: boolean;
  jobs: readonly EnrichmentJob[];
  maxBatchSize: number;
  loadFamily: (job: EnrichmentJob) => Promise<FontFamilyDoc | undefined>;
  render: (family: FontFamilyDoc) => Promise<unknown>;
  markState: (job: EnrichmentJob, state: EnrichmentJobState, details?: { code?: string; reasons?: string[] }) => Promise<void>;
  submit: (jobs: readonly EnrichmentJob[]) => Promise<void>;
}

export interface CollectEnrichmentJobsResult {
  selected: number;
  rejected: number;
  skippedDisabled: number;
  submitted: number;
}

function preferredAssetReasons(family: FontFamilyDoc): string[] {
  const reasons: string[] = [];
  for (const face of family.faces ?? []) {
    if (face.assets?.length) {
      if (!face.preferredAssetId || !face.assets.some((asset) => asset.id === face.preferredAssetId)) {
        reasons.push(`missing_preferred_asset:${face.id}`);
      }
    } else if (!face.preferredAssetId && !face.woff2?.storagePath && !face.original?.storagePath) {
      reasons.push(`missing_preferred_asset:${face.id}`);
    }
  }
  return reasons;
}

async function markTerminal(
  deps: EnrichmentCollectorDependencies, job: EnrichmentJob, code: string, reasons: string[],
): Promise<void> {
  try { await deps.markState(job, "failed", { code, reasons }); } catch { /* one poison job must not stop the collector */ }
}

/** Collects independently valid jobs. A malformed family never poisons its neighbours. */
export async function collectEnrichmentJobs(
  deps: EnrichmentCollectorDependencies,
): Promise<CollectEnrichmentJobsResult> {
  if (!deps.enabled) {
    await Promise.all(deps.jobs.map(async (job) => {
      try { await deps.markState(job, "skipped_disabled"); } catch { /* terminal state is best effort */ }
    }));
    return { selected: deps.jobs.length, rejected: 0, skippedDisabled: deps.jobs.length, submitted: 0 };
  }

  const accepted: EnrichmentJob[] = [];
  let rejected = 0;
  for (const job of deps.jobs) {
    try {
      const family = await deps.loadFamily(job);
      if (!family) { rejected++; await markTerminal(deps, job, "family_missing", ["family_missing"]); continue; }
      const preflight = preflightFamily(family);
      const reasons = preflight.kind === "rejected" ? preflight.reasons : preferredAssetReasons(family);
      if (reasons.length) {
        rejected++;
        await markTerminal(deps, job, preflight.kind === "rejected" ? preflight.code : "invalid_family", reasons);
        continue;
      }
      try { await deps.render(family); }
      catch (error) {
        rejected++;
        await markTerminal(deps, job, "render_failed", [error instanceof Error ? error.message : "render_failed"]);
        continue;
      }
      accepted.push(job);
    } catch (error) {
      rejected++;
      await markTerminal(deps, job, "collector_failed", [error instanceof Error ? error.message : "collector_failed"]);
    }
  }

  const max = Number.isSafeInteger(deps.maxBatchSize) && deps.maxBatchSize > 0 ? deps.maxBatchSize : 1;
  let submitted = 0;
  for (let offset = 0; offset < accepted.length; offset += max) {
    const batch = accepted.slice(offset, offset + max);
    try {
      await deps.submit(batch);
      await Promise.all(batch.map((job) => deps.markState(job, "submitted")));
      submitted += batch.length;
    } catch {
      await Promise.all(batch.map((job) => deps.markState(job, "retrying")));
    }
  }
  return { selected: deps.jobs.length, rejected, skippedDisabled: 0, submitted };
}
