'use client';

import type { SearchFacets, SearchFilters, SearchStyleRange } from '@/models/search.models';
import { Button } from '@/components/ui/Button';
import { facetLabel, toggle } from '@/components/search/searchFilterUtils';

interface Props {
  filters: SearchFilters;
  facets: SearchFacets;
  onChange: (filters: SearchFilters) => void;
}

export function StylesSection({ filters, facets, onChange }: Props) {
  return (
    <section>
      <h3 className="mb-2 text-[10px] font-black uppercase opacity-60">Styles</h3>
      <div className="flex flex-wrap gap-1.5">
        {facets.styleRanges.map((facet) => (
          <Button
            key={facet.value}
            type="button"
            onClick={() =>
              onChange({
                ...filters,
                styleRanges: toggle(filters.styleRanges, facet.value) as SearchStyleRange[],
              })
            }
            size="filterTiny"
            tone={filters.styleRanges.includes(facet.value as SearchStyleRange) ? 'active' : 'plain'}
          >
            {facetLabel(facet.label, facet.count)}
          </Button>
        ))}
      </div>
    </section>
  );
}

export function MoodSection({ filters, facets, onChange }: Props) {
  return (
    <section>
      <h3 className="mb-2 text-[10px] font-black uppercase opacity-60">Mood</h3>
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
  );
}
