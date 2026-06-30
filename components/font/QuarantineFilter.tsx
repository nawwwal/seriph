'use client';

import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';

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
    <Button
      onClick={() => onToggle(!showQuarantined)}
      className={`${showQuarantined ? 'text-[var(--paper)]' : 'border-2 border-[var(--warning)]'} ${className}`}
      icon={<ShieldAlert size={14} />}
      size="quarantine"
      tone={showQuarantined ? 'solid' : 'default'}
      aria-pressed={showQuarantined}
    >
      <span>
        Quarantined ({quarantinedCount})
      </span>
    </Button>
  );
}
