'use client';

import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';

interface QuarantineFilterProps {
  showQuarantined: boolean;
  onToggle: (show: boolean) => void;
  quarantinedCount: number;
  className?: string;
}

export default function QuarantineFilter({
  showQuarantined,
  onToggle,
  quarantinedCount,
  className = '',
}: QuarantineFilterProps) {
  if (quarantinedCount === 0) {
    return null;
  }

  return (
    <button
      onClick={() => onToggle(!showQuarantined)}
      className={`flex items-center gap-2 uppercase text-xs font-bold px-3 py-2 rounded-[var(--radius)] transition-colors ${
        showQuarantined
          ? 'ink-bg text-[var(--paper)]'
          : 'btn-ink border-2 border-yellow-500'
      } ${className}`}
      aria-pressed={showQuarantined}
    >
      <ShieldAlert size={14} />
      <span>
        Quarantined ({quarantinedCount})
      </span>
    </button>
  );
}

