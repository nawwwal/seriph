'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { clearFamilyDetailNegativeCacheForUser } from '@/lib/cache/familyDetailClient';
import type { IngestRecord } from '@/models/ingest.models';
import { isActiveIngest } from '@/lib/upload/activeIngests';
import { useActiveUploadPolling } from '@/lib/contexts/useActiveUploadPolling';
import { useImportBatchChildren } from '@/lib/hooks/useImportBatchChildren';
import { useImportBatchFeed } from '@/lib/hooks/useImportBatchFeed';
import type { ImportBatchChildren, ImportBatchSummary } from '@/lib/imports/mapImportBatch';

export interface UploadContextValue {
  ingests: IngestRecord[];
  batches: ImportBatchSummary[];
  activeCount: number; // items still in flight (not complete/error/canceled)
  transport: 'realtime' | 'polling';
  isOpen: boolean;
  open: () => void;
  close: () => void;
  uploadProgress: Record<string, number>; // client-driven resumable progress by ingestId
  setUploadProgress: (ingestId: string, percent: number) => void;
  sourceProgress: Record<string, number>;
  setSourceProgress: (sourceId: string, percent: number) => void;
  loadChildren: (batchId: string) => Promise<ImportBatchChildren>;
  onCompleted: (cb: () => void) => () => void; // fires (debounced) on completion
}

const UploadContext = createContext<UploadContextValue | undefined>(undefined);

export function UploadProvider({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [uploadProgress, setProgress] = useState<Record<string, number>>({});
  const completedCbs = useRef(new Set<() => void>());
  const canReadIngests = !isLoading && Boolean(user?.uid);
  const notifyCompleted = useCallback(() => {
    if (user?.uid) clearFamilyDetailNegativeCacheForUser(user.uid);
    completedCbs.current.forEach((cb) => cb());
  }, [user]);
  const feed = useImportBatchFeed({ user, isAuthLoading: isLoading, onCompletion: notifyCompleted });
  const childStatus = useImportBatchChildren({ user, isAuthLoading: isLoading });
  const legacyIngests = useActiveUploadPolling({ user, isAuthLoading: isLoading, uploadProgress, onCompleted: notifyCompleted });

  const setUploadProgress = useCallback((ingestId: string, percent: number) => {
    setProgress((prev) => ({ ...prev, [ingestId]: percent }));
  }, []);

  const onCompleted = useCallback((cb: () => void) => {
    completedCbs.current.add(cb);
    return () => { completedCbs.current.delete(cb); };
  }, []);

  const batchIngests = useMemo(() => feed.batches.map((batch): IngestRecord => ({
    id: batch.batchId,
    ingestId: batch.batchId,
    ownerId: batch.ownerId ?? user?.uid ?? '',
    originalName: batch.label,
    status: batch.outcome === 'succeeded' ? 'finalized' : batch.outcome === 'failed' || batch.outcome === 'canceled' ? 'failed' : 'processing',
    uploadState: batch.outcome === 'active' ? 'uploading' : 'uploaded',
    analysisState: batch.outcome === 'succeeded' ? 'complete' : batch.outcome === 'failed' || batch.outcome === 'canceled' ? 'error' : 'analyzing',
    updatedAt: batch.updatedAt === null ? null : new Date(batch.updatedAt).toISOString(),
  })), [feed.batches, user?.uid]);
  const visibleIngests = useMemo(() => (canReadIngests ? (legacyIngests.length > 0 ? legacyIngests : batchIngests) : []), [batchIngests, canReadIngests, legacyIngests]);

  const activeCount = useMemo(
    () => feed.activeCount + legacyIngests.filter((ing) => isActiveIngest(ing, uploadProgress[ing.ingestId])).length,
    [feed.activeCount, legacyIngests, uploadProgress]
  );

  const value = useMemo<UploadContextValue>(
    () => ({
      ingests: visibleIngests,
      batches: canReadIngests ? feed.batches : [],
      activeCount,
      transport: canReadIngests ? feed.transport : 'realtime',
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      uploadProgress,
      setUploadProgress,
      sourceProgress: uploadProgress,
      setSourceProgress: setUploadProgress,
      loadChildren: childStatus.loadChildren,
      onCompleted,
    }),
    [visibleIngests, canReadIngests, feed.batches, feed.transport, activeCount, isOpen, uploadProgress, setUploadProgress, childStatus.loadChildren, onCompleted]
  );

  return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>;
}

export function useUploads(): UploadContextValue {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error('useUploads must be used within an UploadProvider');
  return ctx;
}
