'use client';

import Link from 'next/link';
import { CheckSquare, ExternalLink, Trash2 } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

interface FamilyContextMenuProps {
  familyId: string;
  x: number;
  y: number;
  onSelect: (familyId: string) => void;
  onDelete: (familyIds: string[]) => void;
  onClose: () => void;
}

export default function FamilyContextMenu({ familyId, x, y, onSelect, onDelete, onClose }: FamilyContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !ref.current?.contains(event.target)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  useLayoutEffect(() => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const margin = 8;
    setPosition({
      left: Math.max(margin, Math.min(x, window.innerWidth - rect.width - margin)),
      top: Math.max(margin, Math.min(y, window.innerHeight - rect.height - margin)),
    });
  }, [x, y]);

  const itemClass = 'flex w-full items-center gap-2 px-3 py-2 text-left uppercase text-xs font-bold btn-ink';

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-40 rule rounded-[var(--radius)] bg-[var(--paper)] shadow-lg overflow-hidden"
      style={{ left: position.left, top: position.top }}
      role="menu"
    >
      <Link href={`/family/${familyId}`} className={itemClass} role="menuitem" onClick={onClose}>
        <ExternalLink size={14} aria-hidden="true" />
        Open
      </Link>
      <button
        type="button"
        className={itemClass}
        role="menuitem"
        onClick={() => {
          onSelect(familyId);
          onClose();
        }}
      >
        <CheckSquare size={14} aria-hidden="true" />
        Select
      </button>
      <button
        type="button"
        className={`${itemClass} text-[var(--danger)]`}
        role="menuitem"
        onClick={() => {
          onDelete([familyId]);
          onClose();
        }}
      >
        <Trash2 size={14} aria-hidden="true" />
        Delete
      </button>
    </div>
  );
}
