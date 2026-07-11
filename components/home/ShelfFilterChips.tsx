'use client';

import { Button } from '@/components/ui/Button';
import {
  SHELF_CLASSIFICATIONS,
  type ShelfFilterState,
  type ShelfVariableFilter,
  toggleFilterValue,
} from './shelfFilters';

interface ShelfFilterChipsProps {
  filters: ShelfFilterState;
  moods: readonly string[];
  onChange: (filters: ShelfFilterState) => void;
}

const VARIABLE_OPTIONS: ShelfVariableFilter[] = ['any', 'variable', 'static'];

export default function ShelfFilterChips({ filters, moods, onChange }: ShelfFilterChipsProps) {
  return (
    <div className="mt-5 space-y-4">
      <section>
        <h3 className="mb-2 text-[10px] font-black uppercase tracking-wide opacity-60">Voice</h3>
        <div className="flex flex-wrap gap-1.5">
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
        <div className="grid grid-cols-3 gap-1">
          {VARIABLE_OPTIONS.map((value) => (
            <Button
              key={value}
              type="button"
              size="filterTiny"
              tone={filters.variable === value ? 'active' : 'plain'}
              onClick={() => onChange({ ...filters, variable: value })}
            >
              {value}
            </Button>
          ))}
        </div>
      </section>
      {moods.length > 0 ? (
        <section>
          <h3 className="mb-2 text-[10px] font-black uppercase tracking-wide opacity-60">Mood</h3>
          <div className="flex flex-wrap gap-1.5">
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
