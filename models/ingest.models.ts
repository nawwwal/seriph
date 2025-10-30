export type IngestStatus =
  | 'uploaded'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'finalized'
  | 'file_moved'
  | string;

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
}
