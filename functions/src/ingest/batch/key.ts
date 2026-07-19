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

export function buildBatchCatalogKey(familyId: string, jobId: string, version: number): string;
export function buildBatchCatalogKey(key: BatchCatalogKey & { jobId: string; providerRunId: string }): string;
export function buildBatchCatalogKey(
  familyOrKey: string | (BatchCatalogKey & { jobId: string; providerRunId: string }),
  jobId?: string,
  version?: number,
): string {
  if (typeof familyOrKey !== "string") {
    const key = familyOrKey;
    return [
      "v2", key.jobId, key.familyId, key.familyVersion ?? key.version ?? 1,
      key.promptVersion ?? "unknown", key.analysisModel ?? "unknown",
      key.embeddingVersion ?? "unknown", key.providerRunId,
    ].map((value) => encodeURIComponent(String(value))).join(":");
  }
  if (!jobId || version === undefined) throw new Error("legacy batch catalog key is incomplete");
  return `${encodeURIComponent(familyOrKey)}:${encodeURIComponent(jobId)}:${version}`;
}

function parseVersion(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

export function parseBatchCatalogKey(raw: string): BatchCatalogKey {
  const parts = raw.split(":");
  if (parts[0] === "v2" && parts.length === 8) {
    const familyVersion = parseVersion(decodeURIComponent(parts[3]));
    if (familyVersion === undefined) return { familyId: raw };
    return {
      jobId: decodeURIComponent(parts[1]),
      familyId: decodeURIComponent(parts[2]),
      familyVersion,
      version: familyVersion,
      promptVersion: decodeURIComponent(parts[4]),
      analysisModel: decodeURIComponent(parts[5]),
      embeddingVersion: decodeURIComponent(parts[6]),
      providerRunId: decodeURIComponent(parts[7]),
    };
  }
  const [familyId, jobId, version] = parts;
  if (!familyId || !jobId || !version) return { familyId: raw };
  const parsedVersion = parseVersion(version);
  if (parsedVersion === undefined) return { familyId: raw };
  return {
    familyId: decodeURIComponent(familyId),
    jobId: decodeURIComponent(jobId),
    version: parsedVersion,
  };
}
