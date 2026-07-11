'use client';

import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import SearchFilterPanel from '@/components/search/SearchFilterPanel';
import SearchResultCard from '@/components/search/SearchResultCard';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/TextInput';
import { useFontSearch } from '@/lib/hooks/useFontSearch';
import { searchHref } from '@/lib/search/searchFilterUrl';
import { notifySearchQueryChange } from '@/lib/search/searchRouteEvents';
import type { SearchFilters } from '@/models/search.models';

export default function SearchWorkspace() {
  const router = useRouter();
  const {
    q, filters, facets, resultCount, setQ, setFilters, results, loading, refining,
    resultPresentation, error,
  } = useFontSearch();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    notifySearchQueryChange(trimmed);
    router.push(searchHref(trimmed, filters));
  }

  function onFiltersChange(next: SearchFilters) {
    setFilters(next);
    router.replace(searchHref(q, next));
  }

  return (
    <AppShell
      sidebar={
        <nav aria-label="Search filters" className="h-full min-w-0 w-full max-w-full overflow-x-hidden overflow-y-auto">
          <SearchFilterPanel filters={filters} facets={facets} onChange={onFiltersChange} />
        </nav>
      }
    >
      <main className="h-full min-h-0 w-full overflow-auto px-5 py-6 sm:px-6 md:px-8 md:py-8">
        <h1 className="cap-tight mb-5 text-[clamp(32px,4.5vw,56px)] font-black uppercase leading-[0.9] tracking-tight">
          Find the right voice
        </h1>

        <form onSubmit={onSubmit} className="flex max-w-3xl gap-2">
          <TextInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="warm geometric sans, something editorial, 90s ski poster…"
            size="search"
          />
          <Button type="submit" disabled={loading} size="mdText" tone="solid">
            {loading ? '…' : refining ? 'Refining' : 'Search'}
          </Button>
        </form>

        {error && results.length === 0 && (
          <p className="mt-4 text-sm text-[var(--danger)]">{error}</p>
        )}
        <p className="mt-6 text-xs uppercase tracking-wide opacity-60">
          {resultPresentation === 'suggestions'
            ? 'Related suggestions'
            : `${results.length < resultCount ? `${results.length} of ` : ''}${resultCount} result${resultCount === 1 ? '' : 's'}`}
          {refining ? ' · refining' : ''}
        </p>

        <div className="mt-4 grid grid-cols-1 grid-poster-gap auto-rows-fr content-start sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {results.map((r) => (
            <SearchResultCard key={r.slug || r.id} r={r} />
          ))}
        </div>

        {results.length === 0 && !loading && !refining && (
          <p className="mt-6 text-sm opacity-60">
            Nothing matched. Try describing the feeling, not the name.
          </p>
        )}
      </main>
    </AppShell>
  );
}
