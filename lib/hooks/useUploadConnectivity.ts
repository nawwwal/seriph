'use client';

import { useEffect } from 'react';
import type { SetFiles } from '@/lib/upload/uploadTypes';

/** Pause active uploads when offline; resume paused ones when back online. */
export function useUploadConnectivity(
  setFiles: SetFiles,
  globalMessage: string | null,
  setGlobalMessage: (msg: string | null) => void
) {
  useEffect(() => {
    const onOnline = () => {
      setFiles((prev) =>
        prev.map((f) => {
          if (f.status === 'paused' && f.uploadTask) {
            f.uploadTask.resume();
            return { ...f, status: 'submitting' as const };
          }
          return f;
        })
      );
      if (globalMessage?.includes('Poor connection')) setGlobalMessage('Connection restored. Uploads resuming...');
    };
    const onOffline = () => {
      setFiles((prev) =>
        prev.map((f) => {
          if (f.status === 'submitting' && f.uploadTask) {
            f.uploadTask.pause();
            return { ...f, status: 'paused' as const };
          }
          return f;
        })
      );
      setGlobalMessage('Poor connection detected. Uploads will resume automatically.');
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [setFiles, globalMessage, setGlobalMessage]);
}
