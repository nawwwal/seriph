'use client';

import { startTransition } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import { FilterBar, type ActiveFilterPill } from '@/components/filters/FilterPrimitives';
import SearchFilterPanel from '@/components/search/SearchFilterPanel';
import SearchResultCard from '@/components/search/SearchResultCard';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/TextInput';
import { useFontSearch } from '@/lib/hooks/useFontSearch';
import { emptySearchFilters } from '@/lib/search/searchFilters';
import { searchHref } from '@/lib/search/searchFilterUrl';
import { notifySearchQueryChange } from '@/lib/search/searchRouteEvents';
import type { SearchFilters } from '@/models/search.models';

export default function SearchWorkspace() {
  const router = useRouter();
  const { q, filters, facets, resultCount, setQ, setFilters, results, loading, refining, resultPresentation, error } = useFontSearch();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    notifySearchQueryChange(trimmed);
    router.push(searchHref(trimmed, filters));
  }

  function onFiltersChange(next: SearchFilters) {
    startTransition(() => {
      setFilters(next);
      router.replace(searchHref(q, next));
    });
  }

  const activePills: ActiveFilterPill[] = [
    ...filters.classifications.map((c) => ({ key: `c:${c}`, label: c, onRemove: () => onFiltersChange({ ...filters, classifications: filters.classifications.filter((x) => x !== c) }) })),
    ...(filters.variable !== 'any' ? [{ key: `v:${filters.variable}`, label: filters.variable, onRemove: () => onFiltersChange({ ...filters, variable: 'any' }) }] : []),
    ...filters.styleRanges.map((s) => ({ key: `s:${s}`, label: `${s} styles`, onRemove: () => onFiltersChange({ ...filters, styleRanges: filters.styleRanges.filter((x) => x !== s) }) })),
    ...filters.moods.map((m) => ({ key: `m:${m}`, label: m, onRemove: () => onFiltersChange({ ...filters, moods: filters.moods.filter((x) => x !== m) }) })),
  ];

  return (
    <AppShell sidebar={<nav aria-label="Search filters" className="h-full min-w-0 w-full max-w-full overflow-x-hidden overflow-y-auto"><SearchFilterPanel filters={filters} facets={facets} onChange={onFiltersChange} /></nav>}>
      <main className="@container h-full min-h-0 w-full overflow-auto px-5 py-6 sm:px-6 md:px-8 md:py-8">
        <form onSubmit={onSubmit} className="flex max-w-3xl gap-2">
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by mood, intent, or name…" size="search" />
          <Button type="submit" disabled={loading} size="mdText" tone="solid">{loading ? '…' : refining ? 'Refining' : 'Search'}</Button>
        </form>
        <FilterBar.ActivePills pills={activePills} onReset={() => onFiltersChange(emptySearchFilters)} />
        {error && results.length === 0 && <p className="mt-4 text-sm text-[var(--danger)]">{error}</p>}
        <p className="mt-5 text-xs uppercase tracking-wide opacity-60">
          {resultPresentation === 'suggestions' ? 'Related' : `${results.length < resultCount ? `${results.length} of ` : ''}${resultCount}`}{refining ? ' · refining' : ''}
        </p>
        <div className="mt-4 grid grid-cols-1 grid-poster-gap auto-rows-fr content-start @min-[34rem]:grid-cols-2 @min-[54rem]:grid-cols-3 @min-[74rem]:grid-cols-4">
          {results.map((r) => <SearchResultCard key={r.slug || r.id} r={r} />)}
        </div>
        {results.length === 0 && !loading && !refining && <p className="mt-6 text-sm opacity-60">No matches</p>}
      </main>
    </AppShell>
  );
}
