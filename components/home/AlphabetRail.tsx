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
      className="h-full overflow-x-auto md:overflow-x-hidden md:overflow-y-auto"
    >
      <div className="flex min-w-max items-center gap-2 p-2 md:min-w-0 md:flex-col md:items-stretch md:p-4">
        <Button onClick={onImport} size="compact">Import</Button>
        {uploadCount > 0 ? (
          <Button onClick={onOpenUploads} size="compact" aria-live="polite">
            Uploads {uploadCount}
          </Button>
        ) : null}
        {ALPHABET_INITIALS.map((initial) => {
          const isSelected = initial === selected;
          return (
            <button
              key={initial}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(initial)}
              className={`theme-focus-ring flex h-8 min-w-10 items-center justify-center px-3 text-xs font-black uppercase hover:ink-bg md:w-full md:justify-start ${isSelected ? 'ink-bg' : ''}`}
            >
              {initial}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
