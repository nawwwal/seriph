'use client';

import { GitMerge, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

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
    <div className="sticky top-3 z-30 mt-4 rule bg-[var(--paper)] rounded-[var(--radius)] p-3 theme-shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="uppercase text-sm font-extrabold">
          {selectedCount} selected
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            className="disabled:opacity-45"
            icon={<GitMerge size={15} aria-hidden="true" />}
            onClick={onMerge}
            disabled={!canMerge || isMutating}
            size="iconText"
          >
            Merge
          </Button>
          <Button
            type="button"
            className="disabled:opacity-45"
            icon={<Trash2 size={15} aria-hidden="true" />}
            onClick={onDelete}
            disabled={selectedCount === 0 || isMutating}
            size="iconText"
            tone="danger"
          >
            Delete
          </Button>
          <Button
            type="button"
            icon={<X size={15} aria-hidden="true" />}
            onClick={onCancel}
            disabled={isMutating}
            size="iconText"
          >
            Cancel
          </Button>
        </div>
      </div>
      {error && <div className="mt-2 text-sm font-bold text-[var(--danger)]">{error}</div>}
    </div>
  );
}
