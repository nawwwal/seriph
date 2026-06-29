'use client';

import { GitMerge, Trash2, X } from 'lucide-react';

interface ShelfSelectionBarProps {
  selectedCount: number;
  canMerge: boolean;
  isMutating: boolean;
  error: string | null;
  onMerge: () => void;
  onDelete: () => void;
  onCancel: () => void;
}

export default function ShelfSelectionBar({
  selectedCount,
  canMerge,
  isMutating,
  error,
  onMerge,
  onDelete,
  onCancel,
}: ShelfSelectionBarProps) {
  return (
    <div className="sticky top-3 z-30 mt-4 rule bg-[var(--paper)] rounded-[var(--radius)] p-3 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="uppercase text-sm font-extrabold">
          {selectedCount} selected
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 uppercase text-xs font-bold rule px-3 py-2 rounded-[var(--radius)] btn-ink disabled:opacity-45"
            onClick={onMerge}
            disabled={!canMerge || isMutating}
          >
            <GitMerge size={15} aria-hidden="true" />
            Merge
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 uppercase text-xs font-bold rule px-3 py-2 rounded-[var(--radius)] text-[var(--danger)] disabled:opacity-45"
            onClick={onDelete}
            disabled={selectedCount === 0 || isMutating}
          >
            <Trash2 size={15} aria-hidden="true" />
            Delete
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 uppercase text-xs font-bold rule px-3 py-2 rounded-[var(--radius)] btn-ink"
            onClick={onCancel}
            disabled={isMutating}
          >
            <X size={15} aria-hidden="true" />
            Cancel
          </button>
        </div>
      </div>
      {error && <div className="mt-2 text-sm font-bold text-[var(--danger)]">{error}</div>}
    </div>
  );
}
