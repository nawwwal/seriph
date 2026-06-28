import type { IngestRecord } from '@/models/ingest.models';

const toIso = (v: any) => (v?.toDate?.() ? v.toDate().toISOString() : v ?? null);

/** Map a raw Firestore ingest doc to the UI IngestRecord shape. */
export function mapIngest(id: string, data: any, uid: string): IngestRecord {
  return {
    id,
    ingestId: data.ingestId ?? id,
    ownerId: data.ownerId ?? uid,
    originalName: data.originalName ?? 'Font file',
    status: data.status ?? 'uploaded',
    error: data.error ?? null,
    errorCode: data.errorCode ?? null,
    familyId: data.familyId ?? null,
    requestId: data.requestId ?? null,
    processingId: data.processingId ?? null,
    uploadSource: data.uploadSource ?? null,
    unprocessedPath: data.unprocessedPath ?? null,
    processedPath: data.processedPath ?? null,
    uploadedAt: toIso(data.uploadedAt),
    updatedAt: toIso(data.updatedAt),
    analysisState: data.analysisState ?? 'not_started',
    uploadState: data.uploadState ?? 'pending',
    uploadProgress: typeof data.uploadProgress === 'number' ? data.uploadProgress : undefined,
    quarantined: data.quarantined ?? false,
    contentHash: data.contentHash ?? undefined,
    quickHash: data.quickHash ?? undefined,
    previewFamilyKey: data.previewFamilyKey ?? undefined,
    canonicalFamilyId: data.canonicalFamilyId ?? undefined,
    normalizationSpecVersion: data.normalizationSpecVersion ?? undefined,
    conflictResolution: data.conflictResolution ?? undefined,
    resumeMetadata: data.resumeMetadata ?? undefined,
  };
}
