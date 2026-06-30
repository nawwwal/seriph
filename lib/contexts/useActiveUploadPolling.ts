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

type ActiveUploadResponse =
  | { kind: 'available'; ingests: IngestRecord[] }
  | { kind: 'unavailable' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isIngestRecord(value: unknown): value is IngestRecord {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.ingestId === 'string' &&
    typeof value.ownerId === 'string' &&
    typeof value.originalName === 'string' &&
    typeof value.status === 'string'
  );
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function readActiveUploadResponse(response: Response): Promise<ActiveUploadResponse> {
  const json = await readJson(response);
  if (!response.ok) return { kind: 'unavailable' };
  if (!isRecord(json) || !isRecord(json.data) || !Array.isArray(json.data.ingests)) {
    return { kind: 'available', ingests: [] };
  }
  return { kind: 'available', ingests: json.data.ingests.filter(isIngestRecord) };
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
        const result = await readActiveUploadResponse(response);
        if (result.kind === 'unavailable') {
          scheduleNextRefresh(previousActiveCount.current > 0 || hasClientUploads);
          return;
        }
        const visible = result.ingests;
        if (cancelled) return;
        setIngests(visible);
        if (previousActiveCount.current > 0 && visible.length === 0) onCompleted();
        previousActiveCount.current = visible.length;
        scheduleNextRefresh(visible.length > 0 || hasClientUploads);
      } catch {
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
