'use client';

import { useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { useUploads } from '@/lib/contexts/UploadContext';
import { getCombinedStatus, type IngestStage } from '@/lib/contexts/ImportContext';
import UploadCenterRow from './UploadCenterRow';
import { Button } from '@/components/ui/Button';

type Filter = 'all' | 'in_progress' | 'complete' | 'error';

export default function UploadCenterModal() {
  const { ingests, isOpen, close, uploadProgress } = useUploads();
  const [filter, setFilter] = useState<Filter>('all');

  const items = useMemo(
    () =>
      ingests.map((ing) => ({
        ing,
        status: getCombinedStatus(ing.uploadState, ing.analysisState, uploadProgress[ing.ingestId]),
      })),
    [ingests, uploadProgress]
  );

  const stats = useMemo(() => {
    const buckets: Record<IngestStage, number> = {
      queued: 0,
      uploading: 0,
      uploaded: 0,
      analyzing: 0,
      enriching: 0,
      complete: 0,
      error: 0,
      quarantined: 0,
      canceled: 0,
    };
    for (const { status } of items) buckets[status.stage] += 1;
    const inProgress =
      buckets.queued + buckets.uploading + buckets.uploaded + buckets.analyzing + buckets.enriching;
    return { total: items.length, inProgress, complete: buckets.complete, errors: buckets.error + buckets.quarantined };
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter(({ status }) => {
      if (filter === 'all') return true;
      if (filter === 'complete') return status.stage === 'complete';
      if (filter === 'error') return status.stage === 'error' || status.stage === 'quarantined';
      return status.stage !== 'complete' && status.stage !== 'error' && status.stage !== 'canceled';
    });
  }, [items, filter]);

  return (
    <Modal isOpen={isOpen} onClose={close} title="Upload Center" size="lg">
      <div className="flex flex-col gap-4 max-h-[70vh]">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { label: 'Total', value: stats.total },
            { label: 'In progress', value: stats.inProgress },
            { label: 'Complete', value: stats.complete },
            { label: 'Errors', value: stats.errors },
          ].map((s) => (
            <div key={s.label} className="rule rounded-[var(--radius)] p-2">
              <div className="text-2xl font-black">{s.value}</div>
              <div className="uppercase text-[10px] font-bold opacity-60">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {(['all', 'in_progress', 'complete', 'error'] as Filter[]).map((f) => (
            <Button
              key={f}
              onClick={() => setFilter(f)}
              size="sm"
              tone={filter === f ? 'active' : 'default'}
            >
              {f.replace('_', ' ')}
            </Button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-auto flex flex-col gap-2 pr-1">
          {filtered.length === 0 ? (
            <p className="text-sm opacity-60 py-6 text-center">No uploads to show.</p>
          ) : (
            filtered.map(({ ing, status }) => <UploadCenterRow key={ing.id} ing={ing} status={status} />)
          )}
        </div>
      </div>
    </Modal>
  );
}
