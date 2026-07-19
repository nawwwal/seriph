'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { ImportBatchSummary } from '@/lib/imports/mapImportBatch';
import { announceStatus } from '@/lib/utils/statusAnnouncer';

export function useShelfUploadAnnouncements(pendingBatches: ImportBatchSummary[]): ImportBatchSummary[] {
  const lastAnnounced = useRef(new Set<string>());
  const activeUploads = useMemo(
    () => pendingBatches.filter((batch) => batch.outcome === 'active' || batch.outcome === 'needs_review'),
    [pendingBatches]
  );

  useEffect(() => {
    pendingBatches.forEach((batch) => {
      const key = `${batch.batchId}:${batch.outcome}`;
      if (lastAnnounced.current.has(key)) return;
      if (batch.outcome !== 'active') {
        lastAnnounced.current.add(key);
        announceStatus(`${batch.label}: ${batch.outcome === 'succeeded' ? 'Complete' : batch.outcome.replace('_', ' ')}`);
      }
    });
  }, [pendingBatches]);

  return activeUploads;
}
