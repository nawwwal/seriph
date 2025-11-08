export type IngestStatus =
  | 'uploaded'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'finalized'
  | 'file_moved'
  | string;

export type AnalysisState =
  | 'not_started'
  | 'queued'
  | 'analyzing'
  | 'enriching'
  | 'complete'
  | 'error'
  | 'retrying'
  | 'quarantined';

export type UploadState =
  | 'pending'
  | 'hashing'
  | 'uploading'
  | 'paused'
  | 'retrying'
  | 'resumed'
  | 'uploaded'
  | 'verifying'
  | 'failed'
  | 'canceled';

export interface ConflictResolution {
  type: 'keep_alternates' | 'replace_older' | 'merge_stylistic_sets' | 'quarantine';
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface ResumeMetadata {
  lastProgress: number;
  lastProgressTime: string;
  sessionId?: string;
}

export interface IngestRecord {
  id: string;
  ingestId: string;
  ownerId: string;
  originalName: string;
  status: IngestStatus;
  error?: string | null;
  errorCode?: string | null;
  familyId?: string | null;
  requestId?: string | null;
  processingId?: string | null;
  uploadSource?: string | null;
  unprocessedPath?: string | null;
  processedPath?: string | null;
  uploadedAt?: string | null;
  updatedAt?: string | null;
  // New fields for enhanced upload and analysis tracking
  analysisState?: AnalysisState;
  contentHash?: string; // Full SHA-256 hash (authoritative)
  quickHash?: string; // First 1-2 MB + length (for session duplicates)
  quarantined?: boolean;
  previewFamilyKey?: string; // Hash of preview-normalized family + uploader + session timestamp
  canonicalFamilyId?: string; // Server-provided canonical family ID
  normalizationSpecVersion?: string; // Client spec version sent with upload
  conflictResolution?: ConflictResolution; // Metadata for style conflicts (server-decided)
  uploadState?: UploadState; // Enhanced upload state tracking
  resumeMetadata?: ResumeMetadata; // For resumable upload state binding
}
