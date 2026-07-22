'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { clearFamilyDetailNegativeCacheForUser } from '@/lib/cache/familyDetailClient';
import { useImportBatchChildren } from '@/lib/hooks/useImportBatchChildren';
import { useImportBatchFeed } from '@/lib/hooks/useImportBatchFeed';
import type { ImportBatchChildren, ImportBatchSummary } from '@/lib/imports/mapImportBatch';

export interface UploadContextValue {
  batches: ImportBatchSummary[];
  notice: string | null;
  setNotice: (notice: string | null) => void;
  isImportOpen: boolean;
  openImport: () => void;
  closeImport: () => void;
  isClientUploading: boolean;
  registerClientUpload: (cancel: () => void) => () => void;
  cancelClientUpload: () => void;
  sourceProgress: Record<string, number>;
  setSourceProgress: (sourceId: string, percent: number | null) => void;
  loadChildren: (batchId: string) => Promise<ImportBatchChildren>;
  onCompleted: (cb: () => void) => () => void; // fires (debounced) on completion
}

const UploadContext = createContext<UploadContextValue | undefined>(undefined);

export function UploadProvider({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [isClientUploading, setIsClientUploading] = useState(false);
  const clientCancel = useRef<(() => void) | null>(null);
  const [sourceProgress, setSourceProgressState] = useState<Record<string, number>>({});
  const completedCbs = useRef(new Set<() => void>());
  const canReadIngests = !isLoading && Boolean(user?.uid);
  const notifyCompleted = useCallback(() => {
    if (user?.uid) clearFamilyDetailNegativeCacheForUser(user.uid);
    completedCbs.current.forEach((cb) => cb());
  }, [user]);
  const feed = useImportBatchFeed({ user, isAuthLoading: isLoading, onCompletion: notifyCompleted });
  const childStatus = useImportBatchChildren({ user, isAuthLoading: isLoading });

  const setSourceProgress = useCallback((sourceId: string, percent: number | null) => {
    setSourceProgressState((prev) => {
      if (percent === null) { if (!(sourceId in prev)) return prev; const next = { ...prev }; delete next[sourceId]; return next; }
      return { ...prev, [sourceId]: Math.max(0, Math.min(100, percent)) };
    });
  }, []);

  const onCompleted = useCallback((cb: () => void) => {
    completedCbs.current.add(cb);
    return () => { completedCbs.current.delete(cb); };
  }, []);

  const registerClientUpload = useCallback((cancel: () => void) => {
    clientCancel.current = cancel;
    setIsClientUploading(true);
    return () => {
      if (clientCancel.current !== cancel) return;
      clientCancel.current = null;
      setIsClientUploading(false);
    };
  }, []);
  const cancelClientUpload = useCallback(() => clientCancel.current?.(), []);

  const value = useMemo<UploadContextValue>(
    () => ({
      batches: canReadIngests ? feed.batches : [],
      notice,
      setNotice,
      isImportOpen,
      openImport: () => setIsImportOpen(true),
      closeImport: () => setIsImportOpen(false),
      isClientUploading,
      registerClientUpload,
      cancelClientUpload,
      sourceProgress,
      setSourceProgress,
      loadChildren: childStatus.loadChildren,
      onCompleted,
    }),
    [canReadIngests, feed.batches, notice, isImportOpen, isClientUploading, sourceProgress, setSourceProgress, registerClientUpload, cancelClientUpload, childStatus.loadChildren, onCompleted]
  );

  return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>;
}

export function useUploads(): UploadContextValue {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error('useUploads must be used within an UploadProvider');
  return ctx;
}
