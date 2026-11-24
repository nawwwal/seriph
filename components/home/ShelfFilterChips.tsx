'use client';

import { FilterBar } from '@/components/filters/FilterPrimitives';
import {
  emptyShelfFilters,
  SHELF_CLASSIFICATIONS,
  type ShelfBuildFilter,
  type ShelfFilterState,
  toggleFilterValue,
} from './shelfFilters';

interface ShelfFilterChipsProps {
  filters: ShelfFilterState;
  moods: readonly string[];
  onChange: (filters: ShelfFilterState) => void;
}

const BUILD_OPTIONS: ShelfBuildFilter[] = ['variable', 'static'];

export default function ShelfFilterChips({ filters, moods, onChange }: ShelfFilterChipsProps) {
  const activeCount = filters.classifications.length + filters.builds.length + filters.moods.length;

  return (
    <FilterBar.Root activeCount={activeCount} onReset={() => onChange(emptyShelfFilters)}>
      <div className="mt-5 space-y-4">
        <FilterBar.Header />
        <FilterBar.Group title="Voice">
          <div className="flex flex-wrap gap-1.5">
            {SHELF_CLASSIFICATIONS.map((classification) => (
              <FilterBar.Chip
                key={classification}
                label={classification.replace(' & ', '/')}
                pressed={filters.classifications.includes(classification)}
                onClick={() => onChange({ ...filters, classifications: toggleFilterValue(filters.classifications, classification) })}
              />
            ))}
          </div>
        </FilterBar.Group>
        <FilterBar.Group title="Build">
          <div className="flex flex-wrap gap-1.5">
            {BUILD_OPTIONS.map((build) => (
              <FilterBar.Chip
                key={build}
                label={build}
                pressed={filters.builds.includes(build)}
                onClick={() => onChange({ ...filters, builds: toggleFilterValue(filters.builds, build) })}
              />
            ))}
          </div>
        </FilterBar.Group>
        {moods.length > 0 && (
          <FilterBar.Group title="Mood">
            <div className="flex flex-wrap gap-1.5">
              {moods.map((mood) => (
                <FilterBar.Chip
                  key={mood}
                  label={mood}
                  pressed={filters.moods.includes(mood)}
                  onClick={() => onChange({ ...filters, moods: toggleFilterValue(filters.moods, mood) })}
                />
              ))}
            </div>
          </FilterBar.Group>
        )}
      </div>
    </FilterBar.Root>
  );
}
