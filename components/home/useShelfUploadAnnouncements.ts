'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { IngestRecord } from '@/models/ingest.models';
import { getCombinedStatus } from '@/lib/upload/combinedStatus';
import { announceStatus } from '@/lib/utils/statusAnnouncer';

export function useShelfUploadAnnouncements(pendingIngests: IngestRecord[]): IngestRecord[] {
  const lastAnnounced = useRef(new Set<string>());
  const activeUploads = useMemo(
    () => pendingIngests.filter((ingest) => ingest.status !== 'completed'),
    [pendingIngests]
  );

  useEffect(() => {
    activeUploads.forEach((ingest) => {
      const status = getCombinedStatus(ingest.uploadState, ingest.analysisState);
      const key = `${ingest.ingestId}:${status.uploadState}:${status.analysisState}`;
      if (lastAnnounced.current.has(key)) return;
      if (status.analysisState === 'complete' || status.uploadState === 'uploaded') {
        lastAnnounced.current.add(key);
        announceStatus(`${ingest.originalName}: ${status.displayText}`);
      }
    });
  }, [activeUploads]);

  return activeUploads;
}
