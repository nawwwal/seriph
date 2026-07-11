'use client';

import { useDeferredValue, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { useSearchIndex } from '@/lib/hooks/useSearchIndex';
import { rankLocalSearch } from '@/lib/search/localSearch';
import { searchHref } from '@/lib/search/searchFilterUrl';
import { notifySearchQueryChange } from '@/lib/search/searchRouteEvents';
import NavSearchSuggestion from '@/components/layout/NavSearchSuggestion';
import { Button } from '@/components/ui/Button';

/** Large header search for the signed-in shell. */
export default function HomeHeaderSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const index = useSearchIndex({ enabled: focused || Boolean(query.trim()) });
  const deferredQuery = useDeferredValue(query.trim());
  const suggestions = useMemo(
    () => rankLocalSearch(index.items, deferredQuery, 6),
    [index.items, deferredQuery],
  );
  const showSuggestions = focused && Boolean(query.trim());

  const commit = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    notifySearchQueryChange(trimmed);
    router.push(searchHref(trimmed));
    setFocused(false);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    commit();
  };

  return (
    <form onSubmit={submit} className="relative min-w-0 flex-1">
      <label className="flex min-w-0 items-center gap-3">
        <Search size={20} className="shrink-0 opacity-45" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 120)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            commit();
          }}
          placeholder="SEARCH YOUR TYPE…"
          aria-label="Search your type library"
          className="header-search-input min-w-0 flex-1 border-0 bg-transparent text-2xl font-bold uppercase not-italic tracking-tight text-[var(--ink)] shadow-none outline-none ring-0 placeholder:text-[var(--ink)]/35 focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none sm:text-3xl md:text-4xl"
          style={{ fontFamily: 'var(--font-league-spartan), system-ui, -apple-system, sans-serif' }}
        />
      </label>
      {showSuggestions ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-[var(--radius)] border border-[var(--ink)]/20 bg-[var(--paper)] theme-shadow-xl">
          <Button type="submit" size="searchSuggestion" tone="plain">
            <Search size={14} aria-hidden="true" />
            <span className="truncate">Search {query.trim()}</span>
          </Button>
          {suggestions.length > 0 ? suggestions.map((item) => (
            <NavSearchSuggestion
              key={item.id}
              item={item}
              onMouseDown={(event) => event.preventDefault()}
            />
          )) : (
            <div className="px-3 py-2 text-xs font-bold uppercase opacity-60">
              {index.isLoading ? 'Searching…' : 'No matches'}
            </div>
          )}
        </div>
      ) : null}
    </form>
  );
}
