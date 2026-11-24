'use client';

import { FilterBar } from '@/components/filters/FilterPrimitives';
import { emptySearchFilters } from '@/lib/search/searchFilters';
import type { SearchFacets, SearchFilters } from '@/models/search.models';
import { BuildSection, VoiceSection } from '@/components/search/searchFilterVoiceBuild';
import { MoodSection, StylesSection } from '@/components/search/searchFilterStylesMood';

interface SearchFilterPanelProps {
  filters: SearchFilters;
  facets: SearchFacets;
  onChange: (filters: SearchFilters) => void;
}

/** Full-height shell rail (AppShell sidebar), composed with FilterBar primitives. */
export default function SearchFilterPanel({ filters, facets, onChange }: SearchFilterPanelProps) {
  const activeCount = filters.classifications.length + filters.moods.length + filters.styleRanges.length + (filters.variable !== 'any' ? 1 : 0);

  return (
    <FilterBar.Root activeCount={activeCount} onReset={() => onChange(emptySearchFilters)}>
      <div className="min-w-0 w-full max-w-full px-3 py-3 sm:px-4 md:px-5 md:pt-5 md:pb-4">
        <FilterBar.Header />
        <div className="space-y-4">
          <VoiceSection filters={filters} facets={facets} onChange={onChange} />
          <BuildSection filters={filters} onChange={onChange} />
          <StylesSection filters={filters} facets={facets} onChange={onChange} />
          <MoodSection filters={filters} facets={facets} onChange={onChange} />
        </div>
      </div>
    </FilterBar.Root>
  );
}
