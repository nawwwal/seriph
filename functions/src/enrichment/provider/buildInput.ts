import { buildPrompt } from "../../ai/enrich/schema";
import type { FontFamilyDoc } from "../../models/catalog.models";
import type { EnrichmentJob } from "../jobs/jobTypes";
import { buildBatchCatalogKey } from "../../ingest/batch/key";
import { expectedJobIds, providerJobId, type ProviderJobIdentity } from "./expectedSet";

export type ProviderJob = Partial<EnrichmentJob> & ProviderJobIdentity;
export type RenderedSpecimen = Buffer | null;

export interface ProviderInputDependencies {
  loadFamily: (job: ProviderJob) => Promise<FontFamilyDoc | undefined>;
  render: (job: ProviderJob, family: FontFamilyDoc) => Promise<RenderedSpecimen>;
  providerRunId?: string;
  specimens?: ReadonlyMap<string, RenderedSpecimen>;
  generationConfig?: Record<string, unknown>;
  safetySettings?: readonly Record<string, string>[];
}

export interface ProviderRejectedJob {
  jobId: string;
  code: "family_missing" | "render_failed";
}

export interface ProviderRunInput {
  id: string;
  rows: string[];
  expectedJobIds: string[];
  rejected: ProviderRejectedJob[];
}

function runId(deps: ProviderInputDependencies): string {
  return deps.providerRunId ?? `enrich-${Date.now()}`;
}

function required(value: unknown, name: string): string {
  if (typeof value !== "string" || !value) throw new Error(`enrichment job is missing ${name}`);
  return value;
}

function rowFor(
  job: ProviderJob, family: FontFamilyDoc, specimen: Buffer | null, id: string, deps: ProviderInputDependencies,
): string {
  const jobId = providerJobId(job);
  const catalogKey = buildBatchCatalogKey({
    jobId,
    familyId: required(job.familyId ?? family.id, "familyId"),
    familyVersion: job.familyVersion,
    promptVersion: job.promptVersion,
    analysisModel: job.analysisModel,
    embeddingVersion: job.embeddingVersion,
    providerRunId: id,
  });
  const parts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }> = [];
  if (specimen) parts.push({ inlineData: { mimeType: "image/png", data: specimen.toString("base64") } });
  parts.push({ text: buildPrompt(family, Boolean(specimen), true, catalogKey) });
  return JSON.stringify({ key: catalogKey, request: {
    contents: [{ role: "user", parts }],
    ...(deps.generationConfig ? { generationConfig: deps.generationConfig } : {}),
    ...(deps.safetySettings ? { safetySettings: deps.safetySettings } : {}),
  } });
}

export async function buildProviderRun(
  jobs: readonly ProviderJob[], deps: ProviderInputDependencies,
): Promise<ProviderRunInput> {
  const id = runId(deps);
  const rows: string[] = [];
  const rejected: ProviderRejectedJob[] = [];
  for (const job of jobs) {
    const jobId = providerJobId(job);
    const family = await deps.loadFamily(job);
    if (!family) { rejected.push({ jobId, code: "family_missing" }); continue; }
    try {
      const specimen = deps.specimens?.has(jobId)
        ? deps.specimens.get(jobId) ?? null
        : await deps.render(job, family);
      if (!specimen) { rejected.push({ jobId, code: "render_failed" }); continue; }
      rows.push(rowFor(job, family, specimen, id, deps));
    } catch {
      rejected.push({ jobId, code: "render_failed" });
    }
  }
  const accepted = jobs.filter((job) => !rejected.some((entry) => entry.jobId === providerJobId(job)));
  return { id, rows, expectedJobIds: expectedJobIds(accepted), rejected };
}
