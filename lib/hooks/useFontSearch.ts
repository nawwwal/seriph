'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useSearchIndex } from '@/lib/hooks/useSearchIndex';
import { useSemanticFontSearch } from '@/lib/hooks/useSemanticFontSearch';
import { mergeSearchResults } from '@/lib/search/localSearch';
import { parseSearchFilters, sameSearchFilters, searchFiltersKey } from '@/lib/search/searchFilterUrl';
import { filterSearchResults } from '@/lib/search/searchFilters';
import { notifySearchQueryChange, queryFromSearchEvent, searchQueryChangedEvent } from '@/lib/search/searchRouteEvents';
import { buildLocalSearchView } from '@/lib/search/searchView';
import type { SearchFilters } from '@/models/search.models';

/** Drives the search field + results, auto-running whenever the URL `q` changes. */
export function useFontSearch() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const urlQuery = searchParams.get('q') ?? '';
  const urlFilters = parseSearchFilters(new URLSearchParams(searchParams.toString()));
  const userId = user?.uid ?? null;
  const [inputState, setInputState] = useState({ urlQuery, q: urlQuery, filters: urlFilters, filtersKey: searchFiltersKey(urlFilters) });
  const routeSyncFrame = useRef<number | null>(null);
  const routeSyncQuery = useRef(urlQuery);
  const searchIndex = useSearchIndex({ enabled: Boolean(user) });
  const liveQuery = inputState.q.trim();
  const searchQuery = useDeferredValue(liveQuery);
  const searchState = useSemanticFontSearch(searchQuery, user ?? null, inputState.filters);
  const activeFilters = inputState.filters;

  if (inputState.urlQuery !== urlQuery || !sameSearchFilters(inputState.filters, urlFilters)) {
    setInputState({ urlQuery, q: urlQuery, filters: urlFilters, filtersKey: searchFiltersKey(urlFilters) });
  }

  useEffect(() => {
    const syncFromSearchEvent = (event: Event) => {
      const query = queryFromSearchEvent(event);
      if (query === null) return;
      setInputState((current) => current.q === query ? current : { ...current, q: query });
    };
    window.addEventListener(searchQueryChangedEvent, syncFromSearchEvent);
    return () => window.removeEventListener(searchQueryChangedEvent, syncFromSearchEvent);
  }, []);

  useEffect(() => () => {
    if (routeSyncFrame.current !== null) window.cancelAnimationFrame(routeSyncFrame.current);
  }, []);

  const scheduleRouteSync = useCallback((query: string) => {
    routeSyncQuery.current = query;
    if (routeSyncFrame.current !== null || typeof window === 'undefined') return;
    routeSyncFrame.current = window.requestAnimationFrame(() => {
      routeSyncFrame.current = null;
      notifySearchQueryChange(routeSyncQuery.current);
    });
  }, []);

  const localView = useMemo(() => buildLocalSearchView(searchIndex.items, searchQuery, activeFilters), [activeFilters, searchIndex.items, searchQuery]);
  const hasCurrentSearchState = searchState?.query === searchQuery && searchState.userId === userId;
  const semanticResults = hasCurrentSearchState ? filterSearchResults(searchState.results, activeFilters) : [];
  const results = searchQuery ? mergeSearchResults(semanticResults, localView.results) : localView.results;
  const resultCount = Math.max(localView.resultCount, results.length);
  const loading = Boolean(searchIndex.isLoading && results.length === 0);
  const refining = Boolean(searchQuery && hasCurrentSearchState && searchState?.loading);
  const error = hasCurrentSearchState ? searchState.error : searchIndex.error;
  function setQ(q: string) {
    setInputState((current) => current.q === q ? current : { ...current, q });
    scheduleRouteSync(q);
  }
  function setFilters(filters: SearchFilters) {
    setInputState((current) => sameSearchFilters(current.filters, filters) ? current : { ...current, filters, filtersKey: searchFiltersKey(filters) });
  }

  return {
    q: inputState.q,
    filters: inputState.filters,
    facets: localView.facets,
    resultCount,
    setQ,
    setFilters,
    results,
    loading,
    refining,
    error,
  };
}
