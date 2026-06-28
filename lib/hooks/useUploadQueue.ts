'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { User } from 'firebase/auth';
import type { UploadTask } from 'firebase/storage';
import { runResumableUpload } from '@/lib/upload/runResumableUpload';
import { MAX_CONCURRENT_UPLOADS, type SetFiles, type UploadableFile, type UploadClientStatus } from '@/lib/upload/uploadTypes';

const NON_FINAL: UploadClientStatus[] = ['pending', 'parsing', 'submitting', 'paused', 'retrying', 'resumed', 'verifying'];

interface Args {
  files: UploadableFile[];
  setFiles: SetFiles;
  user: User | null;
  tasks: MutableRefObject<Map<string, UploadTask>>;
  setGlobalMessage: (msg: string | null) => void;
  onUploadComplete?: () => void;
}

/** Runs the bounded-concurrency upload queue and reports batch completion. */
export function useUploadQueue({ files, setFiles, user, tasks, setGlobalMessage, onUploadComplete }: Args) {
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [activeUploadCount, setActiveUploadCount] = useState(0);

  const pump = useCallback(() => {
    if (!user) return;
    const pending = files.filter((f) => f.status === 'pending');
    const canStart = MAX_CONCURRENT_UPLOADS - activeUploadCount;
    for (let i = 0; i < Math.min(pending.length, canStart); i++) {
      const file = pending[i];
      setActiveUploadCount((n) => n + 1);
      runResumableUpload(file, { user, setFiles, tasks }).finally(() => setActiveUploadCount((n) => n - 1));
    }
  }, [files, activeUploadCount, user, setFiles, tasks]);

  useEffect(() => {
    // pump() starts uploads and adjusts activeUploadCount; the effect intentionally
    // re-runs as that count changes to drive the bounded-concurrency queue.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isBatchProcessing && files.some((f) => f.status === 'pending')) pump();

    if (isBatchProcessing && activeUploadCount === 0 && !files.some((f) => NON_FINAL.includes(f.status))) {
      setIsBatchProcessing(false);
      const ok = files.filter((f) => f.status === 'processed_by_api').length;
      const failed = files.filter((f) => f.status === 'error').length;
      if (ok > 0 && failed === 0) setGlobalMessage(`All ${ok} file(s) submitted successfully for server processing.`);
      else if (files.length > 0) setGlobalMessage(`Batch submission finished. ${ok} submitted, ${failed} failed. Check individual file status.`);
      else setGlobalMessage('No files were submitted.');
      if (onUploadComplete) setTimeout(() => onUploadComplete(), 2000);
    }
  }, [files, activeUploadCount, isBatchProcessing, pump, setGlobalMessage, onUploadComplete]);

  const startBatchUpload = useCallback(() => {
    const pending = files.filter((f) => f.status === 'pending');
    if (pending.length === 0) {
      setGlobalMessage('No new files to submit, or all files are already processed/failed.');
      return;
    }
    setIsBatchProcessing(true);
    setGlobalMessage(`Submitting ${pending.length} file(s)...`);
  }, [files, setGlobalMessage]);

  return { isBatchProcessing, activeUploadCount, startBatchUpload };
}
