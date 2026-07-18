import type { DurableUploadFailure, DurableUploadResult } from '@/models/import-batch.models';
import type { WalkedFile } from '@/utils/walkDirectoryEntries';

export const setupFailure = (error: unknown): DurableUploadFailure => ({ ok: false, phase: 'setup', mutationStarted: false, error });
export async function uploadWithFallback(files: WalkedFile[], durable: (files: WalkedFile[]) => Promise<DurableUploadResult>, legacy: (files: WalkedFile[]) => Promise<unknown>) {
  const result = await durable(files);
  if (result.ok) return true;
  if (!result.mutationStarted) { await legacy(files); return false; }
  throw result.error instanceof Error ? result.error : new Error(`Durable upload failed during ${result.phase}`);
}

