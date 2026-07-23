'use client';

import { useCallback } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useUploads } from '@/lib/contexts/UploadContext';
import { useDurableBatchUpload } from '@/lib/hooks/useDurableBatchUpload';
import { useGlobalImportDrop } from '@/lib/hooks/useGlobalImportDrop';

export default function UploadSurface() {
  const { user } = useAuth();
  const { closeImport } = useUploads();
  const { upload, isUploading } = useDurableBatchUpload();
  const onDrop = useCallback((files: Parameters<typeof upload>[0]) => { if (files.length > 0) { closeImport(); void upload(files); } }, [closeImport, upload]);
  const isDragging = useGlobalImportDrop({ disabled: !user || isUploading, onDrop });

  return isDragging ? <div className="pointer-events-none fixed inset-0 z-30 grid place-items-center bg-[color-mix(in_srgb,var(--ink)_12%,transparent)]" data-global-import-overlay><div className="rule rounded-[var(--radius)] bg-[var(--paper)] px-6 py-4 text-center theme-shadow-lg"><strong className="block text-lg uppercase">Drop to import</strong><span className="text-sm opacity-70">Files, folders, and ZIPs are welcome.</span></div></div> : null;
}
