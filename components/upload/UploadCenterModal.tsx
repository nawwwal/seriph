'use client';

import { useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { useUploads } from '@/lib/contexts/UploadContext';
import { getCombinedStatus } from '@/lib/contexts/ImportContext';
import UploadCenterRow from './UploadCenterRow';
import { Button } from '@/components/ui/Button';
import UploadBatchRow from './UploadBatchRow';
import { matchesUploadFilter, type UploadCenterFilter } from './uploadCenterFilters';

export default function UploadCenterModal() {
  const { batches, ingests, isOpen, close, uploadProgress, sourceProgress, loadChildren } = useUploads();
  const [filter, setFilter] = useState<UploadCenterFilter | null>(null);

  const items = useMemo(
    () =>
      ingests.map((ing) => ({
        ing,
        status: getCombinedStatus(ing.uploadState, ing.analysisState, uploadProgress[ing.ingestId]),
      })),
    [ingests, uploadProgress]
  );

  const filtered = useMemo(() => {
    return filter ? batches.filter((batch) => matchesUploadFilter(batch, filter)) : batches;
  }, [batches, filter]);
  const filteredLegacy = useMemo(() => filter ? items.filter(({ status }) => {
    if (filter === 'completed') return status.stage === 'complete';
    if (filter === 'failed') return status.stage === 'error' || status.stage === 'quarantined';
    if (filter === 'review') return false;
    return status.stage !== 'complete' && status.stage !== 'error' && status.stage !== 'canceled' && status.stage !== 'quarantined';
  }) : items, [items, filter]);

  const stats = useMemo(() => batches.length > 0 ? ({
    total: batches.length,
    active: batches.filter((batch) => batch.outcome === 'active').length,
    completed: batches.filter((batch) => batch.outcome === 'succeeded').length,
    review: batches.filter((batch) => batch.outcome === 'needs_review').length,
    failed: batches.filter((batch) => batch.outcome === 'failed' || batch.outcome === 'partial').length,
  }) : {
    total: items.length,
    active: items.filter(({ status }) => !['complete', 'error', 'quarantined', 'canceled'].includes(status.stage)).length,
    completed: items.filter(({ status }) => status.stage === 'complete').length,
    review: 0,
    failed: items.filter(({ status }) => status.stage === 'error' || status.stage === 'quarantined').length,
  }, [batches, items]);
  const clientProgress = useMemo(() => { const values = Object.values(sourceProgress ?? {}).filter((value) => Number.isFinite(value)); return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : undefined; }, [sourceProgress]);
  const filters: UploadCenterFilter[] = ['active', 'completed', 'review', 'failed'];

  return (
    <Modal isOpen={isOpen} onClose={close} title="Upload Center" size="lg">
      <div data-upload-center-bundle="seriph-upload-center-modal" className="flex flex-col gap-4 max-h-[70vh]">
        <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-5">
          {[
            { label: 'Total', value: stats.total }, { label: 'Active', value: stats.active },
            { label: 'Completed', value: stats.completed }, { label: 'Review', value: stats.review },
            { label: 'Failed', value: stats.failed },
          ].map((s) => (
            <div key={s.label} className="rule rounded-[var(--radius)] p-2">
              <div className="text-2xl font-black">{s.value}</div>
              <div className="uppercase text-[10px] font-bold opacity-60">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {filters.map((f) => (
            <Button
              key={f}
              onClick={() => setFilter(f)}
              size="sm"
              tone={filter === f ? 'active' : 'default'}
              aria-pressed={filter === f}
            >
              {f.replace(/^./, (letter) => letter.toUpperCase())}
            </Button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-auto flex flex-col gap-2 pr-1">
          {batches.length > 0 ? filtered.length === 0 ? (
            <p className="text-sm opacity-60 py-6 text-center">No uploads to show.</p>
          ) : (
            filtered.map((batch) => <UploadBatchRow key={batch.batchId} batch={batch} clientProgress={uploadProgress[batch.batchId] ?? clientProgress} loadChildren={loadChildren} />)
          ) : filteredLegacy.length === 0 ? <p className="text-sm opacity-60 py-6 text-center">No uploads to show.</p> : filteredLegacy.map(({ ing, status }) => <UploadCenterRow key={ing.id} ing={ing} status={status} />)}
        </div>
      </div>
    </Modal>
  );
}
