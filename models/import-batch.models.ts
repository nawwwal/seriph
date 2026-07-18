export type RetryTarget =
  | { kind: 'source'; sourceId: string }
  | { kind: 'item'; itemId: string }
  | { kind: 'family'; familyPlanId: string }
  | { kind: 'enrichment'; jobId: string };

export interface CreateBatchInput { label: string; expectedSourceCount: number; idempotencyKey: string; }
export interface CreatedBatch { batchId: string; }
export interface SourceRegistrationInput { sourceId: string; originalName: string; relativePath: string; size: number; declaredContentType?: string; }
export interface RegisteredSource extends SourceRegistrationInput { accepted: boolean; storagePath?: string; state?: 'uploading' | 'failed'; errorCode?: string; }
export interface UploadFailure { state: 'upload_failed'; detail: string; }
export interface DurableUploadSource { sourceId: string; file: File; relativePath: string; }
export interface RecoverySource { sourceId: string; originalName: string; relativePath: string; size: number; }
export interface RecoverySession { batchId: string; sourceIds: string[]; sources: RecoverySource[]; }
export interface DurableUploadDeps {
  create(input: CreateBatchInput): Promise<CreatedBatch>;
  register(batchId: string, sources: SourceRegistrationInput[]): Promise<RegisteredSource[]>;
  seal(batchId: string): Promise<void>;
  upload(source: RegisteredSource, file: File, onProgress: (percent: number) => void): Promise<void>;
  fail(batchId: string, sourceId: string, error: UploadFailure): Promise<void>;
  persist?(session: RecoverySession): void;
}
