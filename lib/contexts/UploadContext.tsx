'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/contexts/AuthContext';
import type { IngestRecord } from '@/models/ingest.models';
import { getCombinedStatus } from '@/lib/upload/combinedStatus';
import { mapIngest } from '@/lib/upload/mapIngest';

interface UploadContextValue {
  ingests: IngestRecord[];
  activeCount: number; // items still in flight (not complete/error/canceled)
  isOpen: boolean;
  open: () => void;
  close: () => void;
  uploadProgress: Record<string, number>; // client-driven resumable progress by ingestId
  setUploadProgress: (ingestId: string, percent: number) => void;
  onCompleted: (cb: () => void) => () => void; // fires (debounced) on completion
}

const UploadContext = createContext<UploadContextValue | undefined>(undefined);

export function UploadProvider({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const [ingests, setIngests] = useState<IngestRecord[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [uploadProgress, setProgress] = useState<Record<string, number>>({});
  const completedCbs = useRef(new Set<() => void>());
  const reloadTimer = useRef<NodeJS.Timeout | null>(null);
  const canReadIngests = !isLoading && Boolean(user?.uid);

  useEffect(() => {
    if (!canReadIngests || !user?.uid) return;

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
  }, [user?.uid, canReadIngests]);

  const setUploadProgress = useCallback((ingestId: string, percent: number) => {
    setProgress((prev) => ({ ...prev, [ingestId]: percent }));
  }, []);

  const onCompleted = useCallback((cb: () => void) => {
    completedCbs.current.add(cb);
    return () => { completedCbs.current.delete(cb); };
  }, []);

  const visibleIngests = useMemo(() => (canReadIngests ? ingests : []), [canReadIngests, ingests]);

  const activeCount = useMemo(
    () =>
      visibleIngests.filter((ing) => {
        const { stage } = getCombinedStatus(ing.uploadState, ing.analysisState, uploadProgress[ing.ingestId]);
        return stage !== 'complete' && stage !== 'error' && stage !== 'canceled';
      }).length,
    [visibleIngests, uploadProgress]
  );

  const value = useMemo<UploadContextValue>(
    () => ({
      ingests: visibleIngests,
      activeCount,
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      uploadProgress,
      setUploadProgress,
      onCompleted,
    }),
    [visibleIngests, activeCount, isOpen, uploadProgress, setUploadProgress, onCompleted]
  );

  return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>;
}

export function useUploads(): UploadContextValue {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error('useUploads must be used within an UploadProvider');
  return ctx;
}
