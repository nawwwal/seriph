import type { WalkedFile } from '@/utils/walkDirectoryEntries';

const REGISTER_CHUNK = 100;

export interface RegisterResult {
  success: boolean;
  originalName: string;
  ingestId?: string;
  storagePath?: string;
  processingId?: string;
  error?: string;
}

export interface RegisteredFile {
  walked: WalkedFile;
  reg: RegisterResult;
}

/** Register intake items in chunks; return the successfully-registered files and batchId. */
export async function registerBatch(
  walked: WalkedFile[],
  idToken: string
): Promise<{ registered: RegisteredFile[]; batchId?: string }> {
  let batchId: string | undefined;
  const registered: RegisteredFile[] = [];

  for (let i = 0; i < walked.length; i += REGISTER_CHUNK) {
    const slice = walked.slice(i, i + REGISTER_CHUNK);
    const res = await fetch('/api/v1/uploads/registrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({
        batchId,
        files: slice.map((w) => ({
          originalName: w.file.name,
          size: w.file.size,
          relativePath: w.relativePath,
          contentType: w.file.type || undefined,
        })),
      }),
    });
    const json = await res.json();
    batchId = json.data?.batchId ?? batchId;
    const results: RegisterResult[] = json.data?.results ?? [];
    results.forEach((reg, idx) => {
      if (reg.success && reg.storagePath) registered.push({ walked: slice[idx], reg });
    });
  }

  return { registered, batchId };
}
