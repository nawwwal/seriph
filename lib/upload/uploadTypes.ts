import type { Dispatch, SetStateAction } from 'react';
import type { UploadTask } from 'firebase/storage';
import type { ParseResult } from '@/lib/workers/fontParseTypes';

export type UploadClientStatus =
  | 'pending' // waiting in client queue
  | 'parsing' // parsing font for preview grouping
  | 'submitting' // resumable upload in progress
  | 'paused' // paused (user action or offline)
  | 'retrying' // retry after failure
  | 'resumed' // resumed after pause
  | 'verifying' // server confirming integrity
  | 'processed_by_api' // upload complete, submitted
  | 'error'; // upload or API failure

export interface UploadableFile {
  id: string;
  file: File;
  status: UploadClientStatus;
  progress: number;
  error?: string;
  apiResponseMessage?: string;
  parseResult?: ParseResult;
  parseError?: string;
  uploadTask?: UploadTask;
  ingestId?: string;
  retryCount?: number;
  lastProgressTime?: string;
}

export type SetFiles = Dispatch<SetStateAction<UploadableFile[]>>;

export const MAX_CONCURRENT_UPLOADS = 3;

/** Immutably patch the file with the given id. */
export function patchFile(setFiles: SetFiles, id: string, patch: Partial<UploadableFile>): void {
  setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
}
