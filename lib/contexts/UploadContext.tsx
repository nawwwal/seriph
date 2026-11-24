'use client';

import { createContext, use, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { clearFamilyDetailNegativeCacheForUser } from '@/lib/cache/familyDetailClient';
import { useImportBatchChildren } from '@/lib/hooks/useImportBatchChildren';
import { useImportBatchFeed } from '@/lib/hooks/useImportBatchFeed';
import { useDurableUploadRunner } from '@/lib/imports/durableUploadRunner';
import type { ImportBatchChildren, ImportBatchSummary } from '@/lib/imports/mapImportBatch';
import type { DurableUploadResult, RecoverySession } from '@/models/import-batch.models';
import type { WalkedFile } from '@/utils/walkDirectoryEntries';

export interface UploadSourcePreview { sourceId: string; name: string; }
export interface UploadContextState {
  batches: ImportBatchSummary[];
  childrenByBatch: Record<string, ImportBatchChildren>;
  notice: string | null;
  isImportOpen: boolean;
  isClientUploading: boolean;
  sourceProgress: Record<string, number>;
  sourcePreviews: UploadSourcePreview[];
  recovery: RecoverySession | null;
}
export interface UploadContextActions {
  setNotice: (notice: string | null) => void;
  openImport: () => void;
  closeImport: () => void;
  upload: (files: WalkedFile[]) => Promise<DurableUploadResult>;
  registerClientUpload: (cancel: () => void) => () => void;
  cancelClientUpload: () => void;
  setSourceProgress: (sourceId: string, percent: number | null) => void;
  setSourcePreviews: (previews: UploadSourcePreview[]) => void;
  loadChildren: (batchId: string) => Promise<ImportBatchChildren>;
  refreshChildren: (batchId: string) => Promise<ImportBatchChildren>;
  collapseChildren: (batchId: string) => void;
  onCompleted: (cb: () => void) => () => void;
}
export interface UploadContextMeta { uploadEnabled: boolean; }
export interface UploadContextValue {
  state: UploadContextState;
  actions: UploadContextActions;
  meta: UploadContextMeta;
}

const UploadStateContext = createContext<UploadContextState | undefined>(undefined);
const UploadActionsContext = createContext<UploadContextActions | undefined>(undefined);
const UploadMetaContext = createContext<UploadContextMeta | undefined>(undefined);

export function UploadProvider({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [isClientUploading, setIsClientUploading] = useState(false);
  const clientCancel = useRef<(() => void) | null>(null);
  const [sourceProgress, setSourceProgressState] = useState<Record<string, number>>({});
  const [sourcePreviews, setSourcePreviews] = useState<UploadSourcePreview[]>([]);
  const completedCbs = useRef(new Set<() => void>());
  const canReadIngests = !isLoading && Boolean(user?.uid);
  const notifyCompleted = useCallback(() => { if (user?.uid) clearFamilyDetailNegativeCacheForUser(user.uid); completedCbs.current.forEach((cb) => cb()); }, [user]);
  const feed = useImportBatchFeed({ user, isAuthLoading: isLoading, onCompletion: notifyCompleted });
  const childStatus = useImportBatchChildren({ user, isAuthLoading: isLoading });
  const setSourceProgress = useCallback((sourceId: string, percent: number | null) => {
    setSourceProgressState((prev) => { if (percent === null) { if (!(sourceId in prev)) return prev; const next = { ...prev }; delete next[sourceId]; return next; } return { ...prev, [sourceId]: Math.max(0, Math.min(100, percent)) }; });
  }, []);
  const onCompleted = useCallback((cb: () => void) => { completedCbs.current.add(cb); return () => { completedCbs.current.delete(cb); }; }, []);
  const registerClientUpload = useCallback((cancel: () => void) => {
    clientCancel.current = cancel; setIsClientUploading(true);
    return () => { if (clientCancel.current !== cancel) return; clientCancel.current = null; setIsClientUploading(false); };
  }, []);
  const runner = useDurableUploadRunner({ user, setNotice, registerClientUpload, setSourceProgress, setSourcePreviews });
  const cancelClientUpload = useCallback(() => { runner.cancel(); clientCancel.current?.(); }, [runner]);
  const openImport = useCallback(() => setIsImportOpen(true), []);
  const closeImport = useCallback(() => setIsImportOpen(false), []);

  const state = useMemo<UploadContextState>(() => ({
    batches: canReadIngests ? feed.batches : [],
    childrenByBatch: childStatus.children,
    notice,
    isImportOpen,
    isClientUploading: isClientUploading || runner.isUploading,
    sourceProgress,
    sourcePreviews,
    recovery: runner.recovery,
  }), [canReadIngests, feed.batches, childStatus.children, notice, isImportOpen, isClientUploading, runner.isUploading, runner.recovery, sourceProgress, sourcePreviews]);

  const actions = useMemo<UploadContextActions>(() => ({
    setNotice, openImport, closeImport, upload: runner.upload, registerClientUpload, cancelClientUpload,
    setSourceProgress, setSourcePreviews, loadChildren: childStatus.loadChildren, refreshChildren: childStatus.refreshChildren,
    collapseChildren: childStatus.collapse, onCompleted,
  }), [runner.upload, registerClientUpload, cancelClientUpload, setSourceProgress, childStatus.loadChildren, childStatus.refreshChildren, childStatus.collapse, onCompleted, openImport, closeImport]);

  const meta = useMemo<UploadContextMeta>(() => ({ uploadEnabled: runner.enabled }), [runner.enabled]);

  return (
    <UploadActionsContext.Provider value={actions}>
      <UploadMetaContext.Provider value={meta}>
        <UploadStateContext.Provider value={state}>{children}</UploadStateContext.Provider>
      </UploadMetaContext.Provider>
    </UploadActionsContext.Provider>
  );
}

export function useUploadState(): UploadContextState {
  const ctx = use(UploadStateContext);
  if (!ctx) throw new Error('useUploadState must be used within an UploadProvider');
  return ctx;
}
export function useUploadActions(): UploadContextActions {
  const ctx = use(UploadActionsContext);
  if (!ctx) throw new Error('useUploadActions must be used within an UploadProvider');
  return ctx;
}
export function useUploadMeta(): UploadContextMeta {
  const ctx = use(UploadMetaContext);
  if (!ctx) throw new Error('useUploadMeta must be used within an UploadProvider');
  return ctx;
}
export function useUploads(): UploadContextValue {
  return { state: useUploadState(), actions: useUploadActions(), meta: useUploadMeta() };
}
