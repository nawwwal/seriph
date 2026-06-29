'use client';

import { Trash2, X } from 'lucide-react';
import { useState } from 'react';

interface DeleteFamiliesDialogProps {
  count: number;
  isDeleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DeleteFamiliesDialog({ count, isDeleting, error, onCancel, onConfirm }: DeleteFamiliesDialogProps) {
  const [confirmation, setConfirmation] = useState('');
  const canConfirm = confirmation === 'DELETE' && !isDeleting;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--ink)_35%,transparent)] p-4">
      <div className="w-full max-w-md rule rounded-[var(--radius)] bg-[var(--paper)] p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="uppercase text-xs font-bold opacity-70">Permanent Delete</div>
            <h2 className="mt-1 text-2xl font-black tracking-normal">Delete {count} {count === 1 ? 'family' : 'families'}?</h2>
          </div>
          <button type="button" onClick={onCancel} className="rule rounded-[var(--radius)] p-2 btn-ink" disabled={isDeleting}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <p className="mt-3 text-sm leading-snug">
          This removes the selected family records and their referenced font assets. Type DELETE to confirm.
        </p>
        <input
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          className="mt-4 w-full rule rounded-[var(--radius)] bg-[var(--surface)] px-3 py-2 font-bold outline-none focus:ring-2 focus:ring-[var(--ink)]"
          autoFocus
        />
        {error && <div className="mt-2 text-sm font-bold text-[var(--danger)]">{error}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="uppercase text-xs font-bold rule px-3 py-2 rounded-[var(--radius)] btn-ink" disabled={isDeleting}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center gap-2 uppercase text-xs font-bold rule px-3 py-2 rounded-[var(--radius)] text-[var(--danger)] disabled:opacity-45"
            disabled={!canConfirm}
          >
            <Trash2 size={15} aria-hidden="true" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
