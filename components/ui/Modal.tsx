'use client';

import { Dialog } from '@base-ui/react/dialog';
import React, { ReactNode } from 'react';
import { X } from 'lucide-react';
import { buttonClassName } from './buttonStyles';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  labelledById?: string; // ID of the element that labels the modal
  describedById?: string; // ID of the element that describes the modal
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  labelledById,
  describedById
}) => {
  let sizeClasses = 'max-w-md'; // default to md
  switch (size) {
    case 'sm': sizeClasses = 'max-w-sm'; break;
    case 'lg': sizeClasses = 'max-w-lg'; break;
    case 'xl': sizeClasses = 'max-w-xl'; break;
    // md is default
  }

  const titleId = labelledById || (title ? 'modal-title' : undefined);

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 theme-overlay z-50 flex items-center justify-center p-4 transition-opacity duration-300 ease-in-out" />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
          <Dialog.Popup
            aria-labelledby={titleId}
            aria-describedby={describedById}
            className={`bg-[var(--surface)] text-[var(--on-surface)] rule rounded-[var(--radius)] theme-shadow-xl transform transition-all duration-300 ease-in-out w-full ${sizeClasses} p-6 relative theme-focus-ring pointer-events-auto`}
            tabIndex={0}
          >
            <Dialog.Close
              type="button"
              className={buttonClassName({ size: 'modalClose', tone: 'plain' })}
              aria-label="Close modal"
            >
              <X size={22} aria-hidden="true" />
            </Dialog.Close>
            {title && (
              <Dialog.Title id={titleId} className="text-2xl font-semibold mb-6 pr-10">
                {title}
              </Dialog.Title>
            )}
            <div id={describedById}>
              {children}
            </div>
          </Dialog.Popup>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default Modal;
