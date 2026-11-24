'use client';

import { FilterBar } from '@/components/filters/FilterPrimitives';
import type { SearchFacets, SearchFilters, SearchVariableFilter } from '@/models/search.models';
import { toggle } from '@/components/search/searchFilterUtils';

interface Props {
  filters: SearchFilters;
  facets: SearchFacets;
  onChange: (filters: SearchFilters) => void;
}

export function VoiceSection({ filters, facets, onChange }: Props) {
  if (facets.classifications.length === 0) return null;
  return (
    <FilterBar.Group title="Voice">
      <div className="flex flex-wrap gap-1.5">
        {facets.classifications.map((facet) => (
          <FilterBar.Chip
            key={facet.value}
            label={facet.label.replace(' & ', '/')}
            count={facet.count}
            pressed={filters.classifications.includes(facet.value)}
            onClick={() => onChange({ ...filters, classifications: toggle(filters.classifications, facet.value) })}
          />
        ))}
      </div>
    </FilterBar.Group>
  );
}

export function BuildSection({ filters, onChange }: { filters: SearchFilters; onChange: (filters: SearchFilters) => void }) {
  return (
    <FilterBar.Group title="Build">
      <div className="grid grid-cols-3 gap-1">
        {(['any', 'variable', 'static'] satisfies SearchVariableFilter[]).map((value) => (
          <FilterBar.Chip
            key={value}
            label={value}
            pressed={filters.variable === value}
            onClick={() => onChange({ ...filters, variable: value })}
          />
        ))}
      </div>
    </FilterBar.Group>
  );
}
