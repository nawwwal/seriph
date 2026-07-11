'use client';

import { ALPHABET_INITIALS, type AlphabetInitial } from './alphabetFilter';
import { Button } from '@/components/ui/Button';

interface AlphabetRailProps {
  selected: AlphabetInitial;
  onSelect: (initial: AlphabetInitial) => void;
  onImport: () => void;
  uploadCount: number;
  onOpenUploads: () => void;
}

export default function AlphabetRail({
  selected,
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
        <div className="flex items-center justify-between gap-2">
          <Button onClick={onImport} size="compact">Import</Button>
          {uploadCount > 0 ? (
            <Button onClick={onOpenUploads} size="compact" aria-live="polite">
              Uploads {uploadCount}
            </Button>
          ) : null}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <h2 className="text-xs font-black uppercase">Browse by alphabet</h2>
          <button type="button" aria-pressed={selected === 'ALL'} onClick={() => onSelect('ALL')} className={`theme-focus-ring px-2 py-1 text-[10px] font-black uppercase ${selected === 'ALL' ? 'ink-bg' : 'hover:ink-bg'}`}>All</button>
        </div>
        <div className="mt-2 grid w-[295px] grid-cols-5 border-t border-l border-[var(--ink)]">
          {ALPHABET_INITIALS.slice(1).map((initial) => {
            const isSelected = initial === selected;
            return (
              <button
                key={initial}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelect(initial)}
                className={`theme-focus-ring flex aspect-square items-center justify-center border-r border-b border-[var(--ink)] text-base font-black uppercase hover:ink-bg ${isSelected ? 'ink-bg' : ''}`}
              >
                {initial}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
