export interface BatchCatalogKey {
  familyId: string;
  jobId?: string;
  familyVersion?: number;
  promptVersion?: string;
  analysisModel?: string;
  embeddingVersion?: string;
  providerRunId?: string;
  version?: number;
}

export function buildBatchCatalogKey(key: BatchCatalogKey & { jobId: string; providerRunId: string }): string {
  return [
    "v2", key.jobId, key.familyId, key.familyVersion ?? key.version ?? 1,
    key.promptVersion ?? "unknown", key.analysisModel ?? "unknown",
    key.embeddingVersion ?? "unknown", key.providerRunId,
  ].map((value) => encodeURIComponent(String(value))).join(":");
}

function parseVersion(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

export function parseBatchCatalogKey(raw: string): BatchCatalogKey | null {
  const parts = raw.split(":");
  if (parts.length !== 8 || parts[0] !== "v2") return null;
  try {
    const [, jobIdRaw, familyIdRaw, versionRaw, promptRaw, analysisRaw, embeddingRaw, providerRunRaw] = parts;
    const familyVersion = parseVersion(decodeURIComponent(versionRaw));
    const jobId = decodeURIComponent(jobIdRaw);
    const familyId = decodeURIComponent(familyIdRaw);
    const providerRunId = decodeURIComponent(providerRunRaw);
    if (!jobId || !familyId || !providerRunId || familyVersion === undefined) return null;
    return {
      jobId,
      familyId,
      familyVersion,
      version: familyVersion,
      promptVersion: decodeURIComponent(promptRaw),
      analysisModel: decodeURIComponent(analysisRaw),
      embeddingVersion: decodeURIComponent(embeddingRaw),
      providerRunId,
    };
  } catch {
    return null;
  }
}
