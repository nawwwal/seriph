'use client';

import { useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { useUploads } from '@/lib/contexts/UploadContext';
import { getCombinedStatus, type IngestStage } from '@/lib/contexts/ImportContext';

type Filter = 'all' | 'in_progress' | 'complete' | 'error';

const STAGE_LABEL: Record<IngestStage, string> = {
  queued: 'Queued',
  uploading: 'Uploading',
  uploaded: 'Uploaded',
  analyzing: 'Analyzing',
  enriching: 'Enriching',
  complete: 'Complete',
  error: 'Error',
  quarantined: 'Quarantined',
  canceled: 'Canceled',
};

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
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`uppercase text-xs font-bold rule px-2 py-1 rounded-[var(--radius)] ${
                filter === f ? 'ink-bg' : 'btn-ink'
              }`}
            >
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-auto flex flex-col gap-2 pr-1">
          {filtered.length === 0 ? (
            <p className="text-sm opacity-60 py-6 text-center">No uploads to show.</p>
          ) : (
            filtered.map(({ ing, status }) => (
              <div key={ing.id} className="rule rounded-[var(--radius)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-bold truncate">{ing.originalName}</div>
                  <span
                    className={`uppercase text-[10px] font-bold px-2 py-0.5 rounded-[var(--radius)] whitespace-nowrap ${
                      status.stage === 'complete'
                        ? 'ink-bg text-[var(--paper)]'
                        : status.stage === 'error' || status.stage === 'quarantined'
                          ? 'bg-[var(--danger)] text-[var(--paper)]'
                          : 'btn-ink'
                    }`}
                  >
                    {STAGE_LABEL[status.stage]}
                  </span>
                </div>
                {/* Two-lane progress */}
                <div className="mt-2 h-1.5 w-full bg-[var(--muted)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)] transition-all"
                    style={{ width: `${status.percent}%` }}
                  />
                </div>
                {ing.error && <div className="mt-1 text-xs text-[var(--danger)] truncate">{ing.error}</div>}
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}
