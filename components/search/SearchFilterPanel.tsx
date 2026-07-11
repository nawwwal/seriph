'use client';

import { X } from 'lucide-react';
import { emptySearchFilters, hasSearchFilters } from '@/lib/search/searchFilters';
import type { SearchFacets, SearchFilters } from '@/models/search.models';
import { Button } from '@/components/ui/Button';
import { BuildSection, VoiceSection } from '@/components/search/searchFilterVoiceBuild';
import { MoodSection, StylesSection } from '@/components/search/searchFilterStylesMood';

interface SearchFilterPanelProps {
  filters: SearchFilters;
  facets: SearchFacets;
  onChange: (filters: SearchFilters) => void;
}

/** Full-height shell rail (AppShell sidebar), not a nested content card. */
export default function SearchFilterPanel({ filters, facets, onChange }: SearchFilterPanelProps) {
  const active = hasSearchFilters(filters);

  return (
    <div className="min-w-0 w-full max-w-full px-3 py-3 sm:px-4 md:px-5 md:pt-6 md:pb-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-black uppercase tracking-wide">Filters</h2>
        {active && (
          <Button
            type="button"
            onClick={() => onChange(emptySearchFilters)}
            icon={<X size={14} aria-hidden="true" />}
            size="clearIcon"
            tone="plain"
            aria-label="Clear filters"
          />
        )}
      </div>
      <div className="mt-4 space-y-5">
        <VoiceSection filters={filters} facets={facets} onChange={onChange} />
        <BuildSection filters={filters} onChange={onChange} />
        <StylesSection filters={filters} facets={facets} onChange={onChange} />
        <MoodSection filters={filters} facets={facets} onChange={onChange} />
      </div>
    </div>
  );
}
