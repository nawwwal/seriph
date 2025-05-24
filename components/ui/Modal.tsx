'use client';

import React, { ReactNode, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

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
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle Esc key press to close modal
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      // Focus the modal or its first focusable element when opened
      modalRef.current?.focus();
    } else {
      document.removeEventListener('keydown', handleEsc);
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  let sizeClasses = 'max-w-md'; // default to md
  switch (size) {
    case 'sm': sizeClasses = 'max-w-sm'; break;
    case 'lg': sizeClasses = 'max-w-lg'; break;
    case 'xl': sizeClasses = 'max-w-xl'; break;
    // md is default
  }

  const titleId = labelledById || (title ? 'modal-title' : undefined);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ease-in-out"
      onClick={onClose}
      role="dialog" // Add role dialog
      aria-modal="true" // Indicate it's a modal dialog
      aria-labelledby={titleId}
      aria-describedby={describedById}
      tabIndex={-1} // Make the backdrop focusable for Esc key, but not via Tab initially
    >
      <div
        ref={modalRef}
        className={`bg-white rounded-lg shadow-xl transform transition-all duration-300 ease-in-out w-full ${sizeClasses} p-6 relative outline-none`}
        onClick={(e) => e.stopPropagation()}
        tabIndex={0} // Make the modal content itself focusable
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 transition-colors p-1.5 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          aria-label="Close modal"
        >
          <X size={22} />
        </button>
        {title && (
          <h3 id={titleId} className="text-2xl font-semibold text-gray-800 mb-6 pr-10">
            {title}
          </h3>
        )}
        <div id={describedById}> {/* Content should ideally be wrapped if describedById is used for the whole content */}
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
