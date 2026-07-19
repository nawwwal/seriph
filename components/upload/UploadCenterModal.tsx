'use client';

import { useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { useUploads } from '@/lib/contexts/UploadContext';
import { useAuth } from '@/lib/contexts/AuthContext';
import { createImportBatchActions } from '@/lib/imports/importBatchActions';
import { Button } from '@/components/ui/Button';
import UploadBatchRow from './UploadBatchRow';
import { matchesUploadFilter, toggleUploadFilter, type UploadCenterFilter } from './uploadCenterFilters';

export default function UploadCenterModal() {
  const { batches, isOpen, close, uploadProgress, sourceProgress, loadChildren } = useUploads();
  const { user } = useAuth();
  const [filter, setFilter] = useState<UploadCenterFilter | null>(null);
  const actions = useMemo(() => user ? createImportBatchActions(() => user.getIdToken()) : undefined, [user]);

  const filtered = useMemo(() => {
    return filter ? batches.filter((batch) => matchesUploadFilter(batch, filter)) : batches;
  }, [batches, filter]);
  const stats = useMemo(() => ({
    total: batches.length,
    active: batches.filter((batch) => batch.outcome === 'active').length,
    completed: batches.filter((batch) => batch.outcome === 'succeeded').length,
    review: batches.filter((batch) => batch.outcome === 'needs_review').length,
    failed: batches.filter((batch) => batch.outcome === 'failed' || batch.outcome === 'partial').length,
  }), [batches]);
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
              onClick={() => setFilter((current) => toggleUploadFilter(current, f))}
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
          {filtered.length === 0 ? (
            <p className="text-sm opacity-60 py-6 text-center">No uploads to show.</p>
          ) : (
            filtered.map((batch) => <UploadBatchRow key={batch.batchId} batch={batch} clientProgress={uploadProgress[batch.batchId] ?? clientProgress} loadChildren={loadChildren} actions={actions} />)
          )}
        </div>
      </div>
    </Modal>
  );
}
