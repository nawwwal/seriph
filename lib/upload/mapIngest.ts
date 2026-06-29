import type { AnalysisState, ConflictResolution, IngestRecord, ResumeMetadata, UploadState } from '@/models/ingest.models';

type IngestData = Record<string, unknown>;
const ANALYSIS_STATES = new Set<AnalysisState>(['not_started', 'queued', 'analyzing', 'enriching', 'complete', 'error', 'retrying', 'quarantined']);
const UPLOAD_STATES = new Set<UploadState>(['pending', 'hashing', 'uploading', 'paused', 'retrying', 'resumed', 'uploaded', 'verifying', 'processed_by_api', 'failed', 'error', 'canceled']);
const CONFLICT_TYPES = new Set<ConflictResolution['type']>(['keep_alternates', 'replace_older', 'merge_stylistic_sets', 'quarantine']);

const text = (data: IngestData, key: string) => typeof data[key] === 'string' ? data[key] : undefined;
const object = (value: unknown): IngestData | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as IngestData : null;
const toIso = (value: unknown) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof (value as { toDate?: unknown }).toDate === 'function') {
    return ((value as { toDate: () => Date }).toDate()).toISOString();
  }
  return null;
};
const analysisState = (data: IngestData): AnalysisState => {
  const value = text(data, 'analysisState');
  return value && ANALYSIS_STATES.has(value as AnalysisState) ? value as AnalysisState : 'not_started';
};
const uploadState = (data: IngestData): UploadState => {
  const value = text(data, 'uploadState');
  return value && UPLOAD_STATES.has(value as UploadState) ? value as UploadState : 'pending';
};
function conflictResolution(value: unknown): ConflictResolution | undefined {
  const data = object(value);
  const type = data ? text(data, 'type') : undefined;
  if (!data || !type || !CONFLICT_TYPES.has(type as ConflictResolution['type'])) return undefined;
  return { type: type as ConflictResolution['type'], resolvedAt: text(data, 'resolvedAt'), resolvedBy: text(data, 'resolvedBy') };
}
function resumeMetadata(value: unknown): ResumeMetadata | undefined {
  const data = object(value);
  if (!data || typeof data.lastProgress !== 'number' || typeof data.lastProgressTime !== 'string') return undefined;
  return { lastProgress: data.lastProgress, lastProgressTime: data.lastProgressTime, sessionId: text(data, 'sessionId') };
}

/** Map a raw Firestore ingest doc to the UI IngestRecord shape. */
export function mapIngest(id: string, data: IngestData, uid: string): IngestRecord {
  return {
    id,
    ingestId: text(data, 'ingestId') ?? id,
    ownerId: text(data, 'ownerId') ?? uid,
    originalName: text(data, 'originalName') ?? 'Font file',
    status: text(data, 'status') ?? 'uploaded',
    error: text(data, 'error') ?? null,
    errorCode: text(data, 'errorCode') ?? null,
    familyId: text(data, 'familyId') ?? null,
    requestId: text(data, 'requestId') ?? null,
    processingId: text(data, 'processingId') ?? null,
    uploadSource: text(data, 'uploadSource') ?? null,
    unprocessedPath: text(data, 'unprocessedPath') ?? null,
    processedPath: text(data, 'processedPath') ?? null,
    uploadedAt: toIso(data.uploadedAt),
    updatedAt: toIso(data.updatedAt),
    analysisState: analysisState(data),
    uploadState: uploadState(data),
    uploadProgress: typeof data.uploadProgress === 'number' ? data.uploadProgress : undefined,
    quarantined: data.quarantined === true,
    contentHash: text(data, 'contentHash'),
    quickHash: text(data, 'quickHash'),
    previewFamilyKey: text(data, 'previewFamilyKey'),
    canonicalFamilyId: text(data, 'canonicalFamilyId'),
    normalizationSpecVersion: text(data, 'normalizationSpecVersion'),
    conflictResolution: conflictResolution(data.conflictResolution),
    resumeMetadata: resumeMetadata(data.resumeMetadata),
  };
}
