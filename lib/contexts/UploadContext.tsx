'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { clearFamilyDetailNegativeCacheForUser } from '@/lib/cache/familyDetailClient';
import { useImportBatchChildren } from '@/lib/hooks/useImportBatchChildren';
import { useImportBatchFeed } from '@/lib/hooks/useImportBatchFeed';
import type { ImportBatchChildren, ImportBatchSummary } from '@/lib/imports/mapImportBatch';

export interface UploadContextValue {
  batches: ImportBatchSummary[];
  activeCount: number; // items still in flight (not complete/error/canceled)
  transport: 'realtime' | 'polling';
  isOpen: boolean;
  open: () => void;
  close: () => void;
  sourceProgress: Record<string, number>;
  setSourceProgress: (sourceId: string, percent: number | null) => void;
  loadChildren: (batchId: string) => Promise<ImportBatchChildren>;
  onCompleted: (cb: () => void) => () => void; // fires (debounced) on completion
}

const UploadContext = createContext<UploadContextValue | undefined>(undefined);

export function UploadProvider({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
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

  const activeCount = feed.activeCount;

  const value = useMemo<UploadContextValue>(
    () => ({
      batches: canReadIngests ? feed.batches : [],
      activeCount,
      transport: canReadIngests ? feed.transport : 'realtime',
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      sourceProgress,
      setSourceProgress,
      loadChildren: childStatus.loadChildren,
      onCompleted,
    }),
    [canReadIngests, feed.batches, feed.transport, activeCount, isOpen, sourceProgress, setSourceProgress, childStatus.loadChildren, onCompleted]
  );

  return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>;
}

export function useUploads(): UploadContextValue {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error('useUploads must be used within an UploadProvider');
  return ctx;
}
