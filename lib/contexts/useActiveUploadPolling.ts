'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import type { IngestRecord } from '@/models/ingest.models';

interface UseActiveUploadPollingInput {
  user: User | null;
  isAuthLoading: boolean;
  uploadProgress: Record<string, number>;
  onCompleted: () => void;
}

export function useActiveUploadPolling({
  user,
  isAuthLoading,
  uploadProgress,
  onCompleted,
}: UseActiveUploadPollingInput): IngestRecord[] {
  const [ingests, setIngests] = useState<IngestRecord[]>([]);
  const previousActiveCount = useRef(0);
  const hasClientUploads = useMemo(
    () => Object.values(uploadProgress).some((percent) => percent > 0 && percent < 100),
    [uploadProgress]
  );
  const canReadIngests = !isAuthLoading && Boolean(user?.uid);

  useEffect(() => {
    if (!canReadIngests || !user?.uid) {
      previousActiveCount.current = 0;
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleNextRefresh = (shouldPoll: boolean) => {
      if (!cancelled && shouldPoll) timer = setTimeout(() => void loadActiveUploads(), 8000);
    };

    const loadActiveUploads = async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/v1/uploads/active', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await response.json();
        if (!response.ok) throw new Error(json?.error?.message || `Upload status failed: ${response.status}`);
        const visible = Array.isArray(json?.data?.ingests) ? json.data.ingests : [];
        if (cancelled) return;
        setIngests(visible);
        if (previousActiveCount.current > 0 && visible.length === 0) onCompleted();
        previousActiveCount.current = visible.length;
        scheduleNextRefresh(visible.length > 0 || hasClientUploads);
      } catch (err) {
        if (!cancelled) console.error('Upload status refresh error', err);
        scheduleNextRefresh(previousActiveCount.current > 0 || hasClientUploads);
      }
    };

    void loadActiveUploads();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [canReadIngests, hasClientUploads, onCompleted, user, user?.uid]);

  return canReadIngests ? ingests : [];
}
