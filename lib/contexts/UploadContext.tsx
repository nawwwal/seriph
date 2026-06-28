'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/contexts/AuthContext';
import type { IngestRecord } from '@/models/ingest.models';
import { getCombinedStatus } from '@/lib/contexts/ImportContext';

interface UploadContextValue {
  /** Live ingest records for the signed-in user (non-completed + recently done). */
  ingests: IngestRecord[];
  /** Count of items still in flight (not complete/error/canceled). */
  activeCount: number;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  /** Client-driven resumable progress, keyed by ingestId (0-100). */
  uploadProgress: Record<string, number>;
  setUploadProgress: (ingestId: string, percent: number) => void;
  /** Fires (debounced) when any ingest transitions to completed. */
  onCompleted: (cb: () => void) => () => void;
}

const UploadContext = createContext<UploadContextValue | undefined>(undefined);

function mapIngest(id: string, data: any, uid: string): IngestRecord {
  const toIso = (v: any) => (v?.toDate?.() ? v.toDate().toISOString() : v ?? null);
  return {
    id,
    ingestId: data.ingestId ?? id,
    ownerId: data.ownerId ?? uid,
    originalName: data.originalName ?? 'Font file',
    status: data.status ?? 'uploaded',
    error: data.error ?? null,
    errorCode: data.errorCode ?? null,
    familyId: data.familyId ?? null,
    requestId: data.requestId ?? null,
    processingId: data.processingId ?? null,
    uploadSource: data.uploadSource ?? null,
    unprocessedPath: data.unprocessedPath ?? null,
    processedPath: data.processedPath ?? null,
    uploadedAt: toIso(data.uploadedAt),
    updatedAt: toIso(data.updatedAt),
    analysisState: data.analysisState ?? 'not_started',
    uploadState: data.uploadState ?? 'pending',
    uploadProgress: typeof data.uploadProgress === 'number' ? data.uploadProgress : undefined,
    quarantined: data.quarantined ?? false,
    contentHash: data.contentHash ?? undefined,
    quickHash: data.quickHash ?? undefined,
    previewFamilyKey: data.previewFamilyKey ?? undefined,
    canonicalFamilyId: data.canonicalFamilyId ?? undefined,
    normalizationSpecVersion: data.normalizationSpecVersion ?? undefined,
    conflictResolution: data.conflictResolution ?? undefined,
    resumeMetadata: data.resumeMetadata ?? undefined,
  };
}

export function UploadProvider({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const [ingests, setIngests] = useState<IngestRecord[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [uploadProgress, setProgress] = useState<Record<string, number>>({});
  const completedCbs = useRef(new Set<() => void>());
  const reloadTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isLoading || !user?.uid) {
      setIngests([]);
      return;
    }
    const col = collection(db, 'users', user.uid, 'ingests');
    const unsub = onSnapshot(
      col,
      (snap) => {
        const all = snap.docs.map((d) => mapIngest(d.id, d.data() as any, user.uid));
        const visible = all.filter((ing) => (ing.status ?? 'uploaded') !== 'completed');
        setIngests(visible);
        if (all.some((ing) => ing.status === 'completed')) {
          if (reloadTimer.current) clearTimeout(reloadTimer.current);
          reloadTimer.current = setTimeout(() => {
            completedCbs.current.forEach((cb) => cb());
          }, 800);
        }
      },
      (err) => console.error('Upload snapshot error', err)
    );
    return () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      unsub();
    };
  }, [user?.uid, isLoading]);

  const setUploadProgress = useCallback((ingestId: string, percent: number) => {
    setProgress((prev) => ({ ...prev, [ingestId]: percent }));
  }, []);

  const onCompleted = useCallback((cb: () => void) => {
    completedCbs.current.add(cb);
    return () => {
      completedCbs.current.delete(cb);
    };
  }, []);

  const activeCount = useMemo(
    () =>
      ingests.filter((ing) => {
        const { stage } = getCombinedStatus(
          ing.uploadState,
          ing.analysisState,
          uploadProgress[ing.ingestId]
        );
        return stage !== 'complete' && stage !== 'error' && stage !== 'canceled';
      }).length,
    [ingests, uploadProgress]
  );

  const value = useMemo<UploadContextValue>(
    () => ({
      ingests,
      activeCount,
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      uploadProgress,
      setUploadProgress,
      onCompleted,
    }),
    [ingests, activeCount, isOpen, uploadProgress, setUploadProgress, onCompleted]
  );

  return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>;
}

export function useUploads(): UploadContextValue {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error('useUploads must be used within an UploadProvider');
  return ctx;
}
