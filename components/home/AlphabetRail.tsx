'use client';

import {
  LETTER_INITIALS,
  toggleAlphabetInitial,
  type AlphabetInitial,
  type LetterInitial,
} from './alphabetFilter';
import type { ShelfFilterState } from './shelfFilters';
import ShelfFilterChips from './ShelfFilterChips';

interface AlphabetRailProps {
  selected: AlphabetInitial;
  presentInitials: ReadonlySet<LetterInitial>;
  onSelect: (initial: AlphabetInitial) => void;
  filters: ShelfFilterState;
  moods: readonly string[];
  onFiltersChange: (filters: ShelfFilterState) => void;
}

export default function AlphabetRail({
  selected,
  presentInitials,
  onSelect,
  filters,
  moods,
  onFiltersChange,
}: AlphabetRailProps) {
  return (
    <nav
      aria-label="Filter families by initial"
      className="h-full min-w-0 w-full max-w-full overflow-x-hidden overflow-y-auto"
    >
      <div className="min-w-0 w-full px-3 py-3 sm:px-4 md:px-5 md:pt-6 md:pb-4">
        <div className="grid w-full grid-cols-5 border-t border-l border-[var(--ink)]">
          {LETTER_INITIALS.map((initial) => {
            const isSelected = initial === selected;
            const isPresent = presentInitials.has(initial);
            return (
              <button
                key={initial}
                type="button"
                aria-pressed={isSelected}
                disabled={!isPresent}
                onClick={() => onSelect(toggleAlphabetInitial(selected, initial))}
                className={`theme-focus-ring flex aspect-square items-center justify-center border-r border-b border-[var(--ink)] text-sm uppercase sm:text-base ${
                  isSelected
                    ? 'ink-bg'
                    : isPresent
                      ? 'hover:ink-bg'
                      : 'cursor-not-allowed'
                }`}
              >
                <span
                  className={
                    isPresent
                      ? 'font-black'
                      : 'font-normal opacity-35'
                  }
                >
                  {initial}
                </span>
              </button>
            );
          })}
        </div>
        <ShelfFilterChips filters={filters} moods={moods} onChange={onFiltersChange} />
      </div>
    </nav>
  );
}
