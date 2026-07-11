'use client';

import { ALPHABET_INITIALS, type AlphabetInitial } from './alphabetFilter';

interface AlphabetRailProps {
  selected: AlphabetInitial;
  onSelect: (initial: AlphabetInitial) => void;
}

export default function AlphabetRail({ selected, onSelect }: AlphabetRailProps) {
  return (
    <nav
      aria-label="Filter families by initial"
      className="h-full overflow-x-auto md:overflow-x-hidden md:overflow-y-auto"
    >
      <div className="flex min-w-max gap-1 p-2 md:min-w-0 md:flex-col md:gap-0 md:p-4">
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
