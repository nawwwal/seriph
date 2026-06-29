export interface BatchCatalogKey {
  familyId: string;
  jobId?: string;
  version?: number;
}

export function buildBatchCatalogKey(familyId: string, jobId: string, version: number): string {
  return `${encodeURIComponent(familyId)}:${encodeURIComponent(jobId)}:${version}`;
}

export function parseBatchCatalogKey(raw: string): BatchCatalogKey {
  const [familyId, jobId, version] = raw.split(":");
  if (!familyId || !jobId || !version) return { familyId: raw };
  const parsedVersion = Number(version);
  if (!Number.isInteger(parsedVersion)) return { familyId: raw };
  return {
    familyId: decodeURIComponent(familyId),
    jobId: decodeURIComponent(jobId),
    version: parsedVersion,
  };
}
