'use client';

import { useCallback, useState } from 'react';
import { ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from '@/lib/firebase/config';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useUploads } from '@/lib/contexts/UploadContext';
import type { WalkedFile } from '@/utils/walkDirectoryEntries';

const REGISTER_CHUNK = 100;
const MAX_CONCURRENT = 4;

interface RegisterResult {
  success: boolean;
  originalName: string;
  ingestId?: string;
  storagePath?: string;
  processingId?: string;
  error?: string;
}

/**
 * Registers intake items, then resumable-uploads each file's bytes to its
 * `intake/**` path, driving live progress into the global Upload Center.
 * The server's expandArchive then normalizes fonts/zips/folders.
 */
export function useResumableBatchUpload() {
  const { user } = useAuth();
  const { setUploadProgress, open } = useUploads();
  const [isUploading, setIsUploading] = useState(false);

  const upload = useCallback(
    async (walked: WalkedFile[]) => {
      if (!user || walked.length === 0) return;
      setIsUploading(true);
      open();
      try {
        const idToken = await user.getIdToken();
        let batchId: string | undefined;

        // 1) Register in chunks to get storage paths + ingest ids.
        const registered: Array<{ walked: WalkedFile; reg: RegisterResult }> = [];
        for (let i = 0; i < walked.length; i += REGISTER_CHUNK) {
          const slice = walked.slice(i, i + REGISTER_CHUNK);
          const res = await fetch('/api/upload/register', {
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
          batchId = json.batchId ?? batchId;
          const results: RegisterResult[] = json.results ?? [];
          results.forEach((reg, idx) => {
            if (reg.success && reg.storagePath) registered.push({ walked: slice[idx], reg });
          });
        }

        // 2) Upload bytes with bounded concurrency.
        let cursor = 0;
        const worker = async () => {
          while (cursor < registered.length) {
            const idx = cursor++;
            const { walked: w, reg } = registered[idx];
            const ingestId = reg.ingestId!;
            await new Promise<void>((resolve) => {
              const task = uploadBytesResumable(ref(storage, reg.storagePath!), w.file, {
                customMetadata: {
                  ownerId: user.uid,
                  batchId: batchId || '',
                  relPath: w.relativePath,
                  processingId: reg.processingId || '',
                },
              });
              task.on(
                'state_changed',
                (snap) => {
                  const pct = snap.totalBytes
                    ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
                    : 0;
                  setUploadProgress(ingestId, pct);
                },
                () => {
                  setUploadProgress(ingestId, 0);
                  resolve();
                },
                () => {
                  setUploadProgress(ingestId, 100);
                  resolve();
                }
              );
            });
          }
        };
        await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT, registered.length) }, worker));
      } finally {
        setIsUploading(false);
      }
    },
    [user, setUploadProgress, open]
  );

  return { upload, isUploading };
}
