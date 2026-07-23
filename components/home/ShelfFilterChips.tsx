'use client';

import { Button } from '@/components/ui/Button';
import {
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
  return (
    <div className="mt-5 space-y-4">
      <section>
        <h3 className="mb-2 text-[10px] font-black uppercase tracking-wide opacity-60">Voice</h3>
        <div className="flex flex-wrap gap-2">
          {SHELF_CLASSIFICATIONS.map((classification) => {
            const active = filters.classifications.includes(classification);
            return (
              <Button
                key={classification}
                type="button"
                size="filterTiny"
                tone={active ? 'active' : 'plain'}
                onClick={() => onChange({
                  ...filters,
                  classifications: toggleFilterValue(filters.classifications, classification),
                })}
              >
                {classification.replace(' & ', '/')}
              </Button>
            );
          })}
        </div>
      </section>
      <section>
        <h3 className="mb-2 text-[10px] font-black uppercase tracking-wide opacity-60">Build</h3>
        <div className="flex flex-wrap gap-2">
          {BUILD_OPTIONS.map((build) => {
            const active = filters.builds.includes(build);
            return (
              <Button
                key={build}
                type="button"
                size="filterTiny"
                tone={active ? 'active' : 'plain'}
                onClick={() => onChange({
                  ...filters,
                  builds: toggleFilterValue(filters.builds, build),
                })}
              >
                {build}
              </Button>
            );
          })}
        </div>
      </section>
      {moods.length > 0 ? (
        <section>
          <h3 className="mb-2 text-[10px] font-black uppercase tracking-wide opacity-60">Mood</h3>
          <div className="flex flex-wrap gap-2">
            {moods.map((mood) => {
              const active = filters.moods.includes(mood);
              return (
                <Button
                  key={mood}
                  type="button"
                  size="filterTiny"
                  tone={active ? 'active' : 'plain'}
                  onClick={() => onChange({
                    ...filters,
                    moods: toggleFilterValue(filters.moods, mood),
                  })}
                >
                  {mood}
                </Button>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
