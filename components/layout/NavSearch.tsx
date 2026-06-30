'use client';

import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { useSearchIndex } from '@/lib/hooks/useSearchIndex';
import { rankLocalSearch } from '@/lib/search/localSearch';
import { searchHref } from '@/lib/search/searchFilterUrl';
import { notifySearchQueryChange, queryFromSearchEvent, searchQueryChangedEvent } from '@/lib/search/searchRouteEvents';
import NavSearchSuggestion from './NavSearchSuggestion';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/TextInput';

export default function NavSearch() {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const index = useSearchIndex({ enabled: focused || Boolean(query.trim()) });
  const deferredQuery = useDeferredValue(query.trim());
  const suggestions = useMemo(() => rankLocalSearch(index.items, deferredQuery, 6), [index.items, deferredQuery]);
  const showSuggestions = focused && Boolean(query.trim());

  useEffect(() => {
    const syncSearchQuery = () => {
      if (pathname === '/search') {
        const next = new URLSearchParams(window.location.search).get('q') ?? '';
        setQuery((current) => current === next ? current : next);
      }
    };
    const syncFromSearchEvent = (event: Event) => {
      const next = queryFromSearchEvent(event);
      if (next !== null) setQuery((current) => current === next ? current : next);
    };
    syncSearchQuery();
    window.addEventListener('popstate', syncSearchQuery);
    window.addEventListener(searchQueryChangedEvent, syncFromSearchEvent);
    return () => {
      window.removeEventListener('popstate', syncSearchQuery);
      window.removeEventListener(searchQueryChangedEvent, syncFromSearchEvent);
    };
  }, [pathname]);

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

  const change = (next: string) => {
    setQuery(next);
  };

  return (
    <form onSubmit={submit} className="relative order-last basis-full sm:order-none sm:basis-auto sm:flex-1 sm:max-w-md sm:ml-1">
      <TextInput
        type="search"
        value={query}
        onChange={(event) => change(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          commit();
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 120)}
        placeholder="Search by mood, intent, vibe…"
        aria-label="Search your type library"
        size="navSearch"
      />
      {showSuggestions && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 rule rounded-[var(--radius)] bg-[var(--paper)] theme-shadow-xl overflow-hidden">
          <Button type="submit" size="searchSuggestion" tone="plain">
            <Search size={14} aria-hidden="true" />
            <span className="truncate">Search {query.trim()}</span>
          </Button>
          {suggestions.length > 0 ? suggestions.map((item) => (
            <NavSearchSuggestion key={item.id} item={item} onMouseDown={(event) => event.preventDefault()} />
          )) : (
            <div className="px-3 py-2 text-xs uppercase font-bold opacity-60">{index.isLoading ? 'Searching…' : 'No matches'}</div>
          )}
        </div>
      )}
    </form>
  );
}
