'use client';

import { Undo2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface MergeUndoToastProps {
  undoExpiresAt: string;
  isMutating: boolean;
  onUndo: () => void;
  onDismiss: () => void;
}

export default function MergeUndoToast({ undoExpiresAt, isMutating, onUndo, onDismiss }: MergeUndoToastProps) {
  return (
    <div className="fixed bottom-5 left-1/2 z-50 flex w-[min(92vw,520px)] -translate-x-1/2 items-center justify-between gap-3 rule rounded-[var(--radius)] bg-[var(--paper)] p-3 theme-shadow-xl">
      <div>
        <div className="uppercase text-xs font-extrabold">Families merged</div>
        <div className="text-xs opacity-70">Undo available until {new Date(undoExpiresAt).toLocaleTimeString()}</div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          icon={<Undo2 size={15} aria-hidden="true" />}
          onClick={onUndo}
          disabled={isMutating}
          size="iconText"
        >
          Undo
        </Button>
        <Button type="button" icon={<X size={15} aria-hidden="true" />} onClick={onDismiss} size="icon" />
      </div>
    </div>
  );
}
