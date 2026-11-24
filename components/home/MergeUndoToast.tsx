'use client';

import { Undo2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface MergeUndoToastProps {
  undoExpiresAt: string;
  isMutating: boolean;
  error?: string | null;
  onUndo: () => void;
  onDismiss: () => void;
}

export default function MergeUndoToast({ undoExpiresAt, isMutating, error, onUndo, onDismiss }: MergeUndoToastProps) {
  return (
    <div role="status" aria-live="polite" className="fixed bottom-16 left-1/2 z-50 flex w-[min(92vw,520px)] -translate-x-1/2 items-center justify-between gap-3 rule rounded-[var(--radius)] bg-[var(--paper)] p-3 theme-shadow-xl">
      <div>
        <div className="uppercase text-xs font-extrabold">Families merged</div>
        <div className="text-xs opacity-70">Undo available until {new Date(undoExpiresAt).toLocaleTimeString()}</div>
        {error && <div className="mt-1 text-xs font-bold text-[var(--danger)]">{error}</div>}
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" icon={<Undo2 size={15} aria-hidden="true" />} onClick={onUndo} disabled={isMutating} size="iconText">
          Undo
        </Button>
        <Button type="button" icon={<X size={15} aria-hidden="true" />} onClick={onDismiss} size="icon" aria-label="Dismiss merge notice" />
      </div>
    </div>
  );
}
