'use client';

import { FilterBar } from '@/components/filters/FilterPrimitives';
import type { SearchFacets, SearchFilters, SearchStyleRange } from '@/models/search.models';
import { toggle } from '@/components/search/searchFilterUtils';

interface Props {
  filters: SearchFilters;
  facets: SearchFacets;
  onChange: (filters: SearchFilters) => void;
}

export function StylesSection({ filters, facets, onChange }: Props) {
  return (
    <FilterBar.Group title="Styles">
      <div className="flex flex-wrap gap-1.5">
        {facets.styleRanges.map((facet) => (
          <FilterBar.Chip
            key={facet.value}
            label={facet.label}
            count={facet.count}
            pressed={filters.styleRanges.includes(facet.value as SearchStyleRange)}
            onClick={() => onChange({ ...filters, styleRanges: toggle(filters.styleRanges, facet.value) as SearchStyleRange[] })}
          />
        ))}
      </div>
    </FilterBar.Group>
  );
}

export function MoodSection({ filters, facets, onChange }: Props) {
  if (facets.moods.length === 0) return null;
  return (
    <FilterBar.Group title="Mood">
      <div className="flex flex-wrap gap-1.5">
        {facets.moods.map((facet) => (
          <FilterBar.Chip
            key={facet.value}
            label={facet.label}
            count={facet.count}
            pressed={filters.moods.includes(facet.value)}
            onClick={() => onChange({ ...filters, moods: toggle(filters.moods, facet.value) })}
          />
        ))}
      </div>
    </FilterBar.Group>
  );
}
