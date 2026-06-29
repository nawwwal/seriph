'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import type { IngestRecord } from '@/models/ingest.models';
import { isActiveIngest } from '@/lib/upload/activeIngests';
import { useActiveUploadPolling } from '@/lib/contexts/useActiveUploadPolling';

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
  const [isOpen, setIsOpen] = useState(false);
  const [uploadProgress, setProgress] = useState<Record<string, number>>({});
  const completedCbs = useRef(new Set<() => void>());
  const canReadIngests = !isLoading && Boolean(user?.uid);
  const notifyCompleted = useCallback(() => completedCbs.current.forEach((cb) => cb()), []);
  const ingests = useActiveUploadPolling({ user, isAuthLoading: isLoading, uploadProgress, onCompleted: notifyCompleted });

  const setUploadProgress = useCallback((ingestId: string, percent: number) => {
    setProgress((prev) => ({ ...prev, [ingestId]: percent }));
  }, []);

  const onCompleted = useCallback((cb: () => void) => {
    completedCbs.current.add(cb);
    return () => { completedCbs.current.delete(cb); };
  }, []);

  const visibleIngests = useMemo(() => (canReadIngests ? ingests : []), [canReadIngests, ingests]);

  const activeCount = useMemo(
    () => visibleIngests.filter((ing) => isActiveIngest(ing, uploadProgress[ing.ingestId])).length,
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
