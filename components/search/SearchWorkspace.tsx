'use client';

import { useRouter } from 'next/navigation';
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
  const { q, filters, facets, resultCount, setQ, setFilters, results, loading, refining, error } = useFontSearch();

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
    <main className="flex-1 w-full px-8 sm:px-10 md:px-12 lg:px-16 py-10 overflow-auto">
      <h1 className="cap-tight uppercase font-black tracking-tight text-[clamp(36px,5vw,64px)] leading-[0.9] mb-6">
        Find the right voice
      </h1>

      <form onSubmit={onSubmit} className="flex gap-2 max-w-3xl">
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

      {error && results.length === 0 && <p className="mt-4 text-sm text-[var(--danger)]">{error}</p>}
      <p className="mt-6 text-xs uppercase tracking-wide opacity-60">
        {results.length < resultCount ? `${results.length} of ` : ''}{resultCount} result{resultCount === 1 ? '' : 's'}{refining ? ' · refining' : ''}
      </p>

      <div className="mt-4 grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)]">
        <SearchFilterPanel filters={filters} facets={facets} onChange={onFiltersChange} />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 grid-poster-gap auto-rows-fr content-start">
          {results.map((r) => <SearchResultCard key={r.slug || r.id} r={r} />)}
        </div>
      </div>

      {results.length === 0 && !loading && !refining && (
        <p className="mt-6 text-sm opacity-60">Nothing matched. Try describing the feeling, not the name.</p>
      )}
    </main>
  );
}
