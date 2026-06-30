'use client';

import { X } from 'lucide-react';
import { emptySearchFilters, hasSearchFilters } from '@/lib/search/searchFilters';
import type { SearchFacets, SearchFilters, SearchStyleRange, SearchVariableFilter } from '@/models/search.models';
import { Button } from '@/components/ui/Button';

interface SearchFilterPanelProps {
  filters: SearchFilters;
  facets: SearchFacets;
  onChange: (filters: SearchFilters) => void;
}

function toggle(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function facetLabel(label: string, count: number): string {
  return `${label} ${count}`;
}

export default function SearchFilterPanel({ filters, facets, onChange }: SearchFilterPanelProps) {
  const active = hasSearchFilters(filters);

  return (
    <aside className="rule rounded-[var(--radius)] bg-[color-mix(in_srgb,var(--ink)_3%,var(--paper))] p-3 lg:p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="uppercase text-xs font-black tracking-wide">Filters</h2>
        {active && (
          <Button type="button" onClick={() => onChange(emptySearchFilters)} icon={<X size={14} aria-hidden="true" />} size="clearIcon" tone="plain" aria-label="Clear filters" />
        )}
      </div>
      <div className="mt-4 space-y-5">
        <section>
          <h3 className="uppercase text-[10px] font-black opacity-60 mb-2">Voice</h3>
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
            {facets.classifications.map((facet) => (
              <label key={facet.value} className="flex items-center gap-2 text-xs uppercase font-bold">
                <input
                  type="checkbox"
                  checked={filters.classifications.includes(facet.value)}
                  onChange={() => onChange({ ...filters, classifications: toggle(filters.classifications, facet.value) })}
                />
                <span className="truncate">{facetLabel(facet.label, facet.count)}</span>
              </label>
            ))}
          </div>
        </section>
        <section>
          <h3 className="uppercase text-[10px] font-black opacity-60 mb-2">Build</h3>
          <div className="grid grid-cols-3 gap-1">
            {(['any', 'variable', 'static'] satisfies SearchVariableFilter[]).map((value) => (
              <Button
                key={value}
                type="button"
                onClick={() => onChange({ ...filters, variable: value })}
                size="filterTiny"
                tone={filters.variable === value ? 'active' : 'plain'}
              >
                {value}
              </Button>
            ))}
          </div>
        </section>
        <section>
          <h3 className="uppercase text-[10px] font-black opacity-60 mb-2">Styles</h3>
          <div className="flex flex-wrap gap-1.5">
            {facets.styleRanges.map((facet) => (
              <Button
                key={facet.value}
                type="button"
                onClick={() => onChange({ ...filters, styleRanges: toggle(filters.styleRanges, facet.value) as SearchStyleRange[] })}
                size="filterTiny"
                tone={filters.styleRanges.includes(facet.value as SearchStyleRange) ? 'active' : 'plain'}
              >
                {facetLabel(facet.label, facet.count)}
              </Button>
            ))}
          </div>
        </section>
        <section>
          <h3 className="uppercase text-[10px] font-black opacity-60 mb-2">Mood</h3>
          <div className="flex flex-wrap gap-1.5">
            {facets.moods.map((facet) => (
              <Button
                key={facet.value}
                type="button"
                onClick={() => onChange({ ...filters, moods: toggle(filters.moods, facet.value) })}
                size="filterTiny"
                tone={filters.moods.includes(facet.value) ? 'active' : 'plain'}
              >
                {facetLabel(facet.label, facet.count)}
              </Button>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}
