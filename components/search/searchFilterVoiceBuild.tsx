'use client';

import type { SearchFacets, SearchFilters, SearchVariableFilter } from '@/models/search.models';
import { Button } from '@/components/ui/Button';
import { facetLabel, toggle } from '@/components/search/searchFilterUtils';

interface Props {
  filters: SearchFilters;
  facets: SearchFacets;
  onChange: (filters: SearchFilters) => void;
}

export function VoiceSection({ filters, facets, onChange }: Props) {
  return (
    <section>
      <h3 className="mb-2 text-[10px] font-black uppercase opacity-60">Voice</h3>
      <div className="grid grid-cols-1 gap-2">
        {facets.classifications.map((facet) => (
          <label key={facet.value} className="flex items-center gap-2 text-xs font-bold uppercase">
            <input
              type="checkbox"
              checked={filters.classifications.includes(facet.value)}
              onChange={() =>
                onChange({
                  ...filters,
                  classifications: toggle(filters.classifications, facet.value),
                })
              }
            />
            <span className="truncate">{facetLabel(facet.label, facet.count)}</span>
          </label>
        ))}
      </div>
    </section>
  );
}

export function BuildSection({
  filters,
  onChange,
}: {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
}) {
  return (
    <section>
      <h3 className="mb-2 text-[10px] font-black uppercase opacity-60">Build</h3>
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
  );
}
