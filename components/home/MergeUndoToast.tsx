'use client';

import { Undo2, X } from 'lucide-react';

interface MergeUndoToastProps {
  undoExpiresAt: string;
  isMutating: boolean;
  onUndo: () => void;
  onDismiss: () => void;
}

export default function MergeUndoToast({ undoExpiresAt, isMutating, onUndo, onDismiss }: MergeUndoToastProps) {
  return (
    <div className="fixed bottom-5 left-1/2 z-50 flex w-[min(92vw,520px)] -translate-x-1/2 items-center justify-between gap-3 rule rounded-[var(--radius)] bg-[var(--paper)] p-3 shadow-xl">
      <div>
        <div className="uppercase text-xs font-extrabold">Families merged</div>
        <div className="text-xs opacity-70">Undo available until {new Date(undoExpiresAt).toLocaleTimeString()}</div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 uppercase text-xs font-bold rule px-3 py-2 rounded-[var(--radius)] btn-ink"
          onClick={onUndo}
          disabled={isMutating}
        >
          <Undo2 size={15} aria-hidden="true" />
          Undo
        </button>
        <button type="button" className="rule rounded-[var(--radius)] p-2 btn-ink" onClick={onDismiss}>
          <X size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
