'use client';

import { ArrowUpFromLine } from 'lucide-react';
import {
  toggleAlphabetInitial,
  type AlphabetInitial,
  type LetterInitial,
} from './alphabetFilter';
import { Button } from '@/components/ui/Button';

interface AlphabetRailProps {
  selected: AlphabetInitial;
  availableInitials: readonly LetterInitial[];
  onSelect: (initial: AlphabetInitial) => void;
  onImport: () => void;
  uploadCount: number;
  onOpenUploads: () => void;
}

export default function AlphabetRail({
  selected,
  availableInitials,
  onSelect,
  onImport,
  uploadCount,
  onOpenUploads,
}: AlphabetRailProps) {
  return (
    <nav
      aria-label="Filter families by initial"
      className="h-full min-w-0 w-full max-w-full overflow-x-auto overflow-y-auto"
    >
      <div className="min-w-0 w-full px-4 py-3 md:pt-8 md:pr-[33px] md:pb-4 md:pl-10">
        <Button onClick={onImport} size="compact" tone="solid" className="w-full flex h-12 items-center justify-between rounded-none px-4 text-sm font-black">
          <span>Import</span>
          <ArrowUpFromLine size={16} aria-hidden="true" />
        </Button>
        {uploadCount > 0 ? (
          <Button onClick={onOpenUploads} size="compact" className="mt-2 w-full" aria-live="polite">
            Uploads {uploadCount}
          </Button>
        ) : null}
        {availableInitials.length > 0 ? (
          <div className="mt-3 grid w-[295px] grid-cols-5 border-t border-l border-[var(--ink)]">
            {availableInitials.map((initial) => {
              const isSelected = initial === selected;
              return (
                <button
                  key={initial}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelect(toggleAlphabetInitial(selected, initial))}
                  className={`theme-focus-ring flex aspect-square items-center justify-center border-r border-b border-[var(--ink)] text-base font-black uppercase hover:ink-bg ${isSelected ? 'ink-bg' : ''}`}
                >
                  {initial}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </nav>
  );
}
