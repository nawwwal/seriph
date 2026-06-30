'use client';

import { AlertDialog } from '@base-ui/react/alert-dialog';
import { Trash2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { buttonClassName } from '@/components/ui/buttonStyles';
import { TextInput } from '@/components/ui/TextInput';

interface DeleteFamiliesDialogProps {
  count: number;
  isDeleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DeleteFamiliesDialog({ count, isDeleting, error, onCancel, onConfirm }: DeleteFamiliesDialogProps) {
  const [confirmation, setConfirmation] = useState('');
  const confirmationRef = useRef<HTMLElement>(null);
  const canConfirm = confirmation === 'DELETE' && !isDeleting;

  return (
    <AlertDialog.Root
      open
      onOpenChange={(open, eventDetails) => {
        if (open || eventDetails.reason === 'escape-key') return;
        if (!isDeleting) onCancel();
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 theme-overlay" />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
          <AlertDialog.Popup
            initialFocus={confirmationRef}
            className="w-full max-w-md rule rounded-[var(--radius)] bg-[var(--paper)] p-5 theme-shadow-xl pointer-events-auto"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="uppercase text-xs font-bold opacity-70">Permanent Delete</div>
                <AlertDialog.Title className="mt-1 text-2xl font-black tracking-normal">Delete {count} {count === 1 ? 'family' : 'families'}?</AlertDialog.Title>
              </div>
              <AlertDialog.Close
                type="button"
                disabled={isDeleting}
                className={buttonClassName({ size: 'icon' })}
                aria-label="Close"
              >
                <X size={16} aria-hidden="true" />
              </AlertDialog.Close>
            </div>
            <AlertDialog.Description className="mt-3 text-sm leading-snug">
              This removes the selected family records and their referenced font assets. Type DELETE to confirm.
            </AlertDialog.Description>
            <TextInput
              ref={confirmationRef}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              size="confirm"
              autoFocus
            />
            {error && <div className="mt-2 text-sm font-bold text-[var(--danger)]">{error}</div>}
            <div className="mt-5 flex justify-end gap-2">
              <AlertDialog.Close
                type="button"
                disabled={isDeleting}
                className={buttonClassName({ size: 'iconText' })}
              >
                Cancel
              </AlertDialog.Close>
              <Button
                type="button"
                onClick={onConfirm}
                className="disabled:opacity-45"
                disabled={!canConfirm}
                icon={<Trash2 size={15} aria-hidden="true" />}
                size="iconText"
                tone="danger"
              >
                Delete
              </Button>
            </div>
          </AlertDialog.Popup>
        </div>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
