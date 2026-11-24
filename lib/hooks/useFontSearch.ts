'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useSearchIndex } from '@/lib/hooks/useSearchIndex';
import { useSemanticFontSearch } from '@/lib/hooks/useSemanticFontSearch';
import { parseSearchFilters, sameSearchFilters, searchFiltersKey } from '@/lib/search/searchFilterUrl';
import { filterSearchResults } from '@/lib/search/searchFilters';
import { searchErrorForDisplay } from '@/lib/search/searchAvailability';
import { notifySearchQueryChange, queryFromSearchEvent, searchQueryChangedEvent } from '@/lib/search/searchRouteEvents';
import { buildLocalSearchView, buildSearchRefinementState } from '@/lib/search/searchView';
import type { SearchFilters } from '@/models/search.models';

/** Drives the search field + results, synchronizing cleanly with URL params and filter controls. */
export function useFontSearch() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const urlQuery = searchParams.get('q') ?? '';
  const urlFilters = useMemo(() => parseSearchFilters(new URLSearchParams(searchParams.toString())), [searchParams]);
  const urlFiltersKey = searchFiltersKey(urlFilters);
  const urlKey = `${urlQuery}::${urlFiltersKey}`;
  const userId = user?.uid ?? null;
  const [draft, setDraft] = useState<{ urlKey: string; q: string; filters: SearchFilters } | null>(null);
  const q = draft?.urlKey === urlKey ? draft.q : urlQuery;
  const filters = draft?.urlKey === urlKey ? draft.filters : urlFilters;
  const filtersKey = searchFiltersKey(filters);
  const routeSyncFrame = useRef<number | null>(null);
  const routeSyncQuery = useRef(urlQuery);
  const searchIndex = useSearchIndex({ enabled: Boolean(user) });
  const liveQuery = q.trim();
  const searchQuery = useDeferredValue(liveQuery);
  const searchState = useSemanticFontSearch(searchQuery, user ?? null, filters, searchIndex.libraryRevision);

  useEffect(() => {
    const syncFromSearchEvent = (event: Event) => {
      const nextQ = queryFromSearchEvent(event);
      if (nextQ === null) return;
      setDraft((cur) => ({ urlKey, q: nextQ, filters: cur?.urlKey === urlKey ? cur.filters : urlFilters }));
    };
    window.addEventListener(searchQueryChangedEvent, syncFromSearchEvent);
    return () => window.removeEventListener(searchQueryChangedEvent, syncFromSearchEvent);
  }, [urlKey, urlFilters]);

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

  const localView = useMemo(() => buildLocalSearchView(searchIndex.items, liveQuery, filters), [filters, liveQuery, searchIndex.items]);
  const hasCurrentSearchState = searchQuery === liveQuery
    && searchState?.query === searchQuery
    && searchState.userId === userId
    && searchState.filtersKey === filtersKey
    && searchState.libraryRevision === searchIndex.libraryRevision;
  const semanticResults = hasCurrentSearchState ? filterSearchResults(searchState.results, filters) : [];
  const refining = Boolean(searchQuery && hasCurrentSearchState && searchState?.loading);
  const { results, isRefining, resultPresentation } = buildSearchRefinementState({
    query: liveQuery,
    localView,
    semanticResults,
    isRefining: refining,
    hasCurrentSemanticResult: Boolean(hasCurrentSearchState),
  });
  const resultCount = Math.max(localView.resultCount, results.length);
  const loading = Boolean(searchIndex.isLoading && results.length === 0);
  const error = searchErrorForDisplay({ hasResults: results.length > 0, indexError: searchIndex.error, indexLoading: searchIndex.isLoading });
  const setQ = (nextQ: string) => {
    setDraft({ urlKey, q: nextQ, filters });
    scheduleRouteSync(nextQ);
  };
  const setFilters = (nextFilters: SearchFilters) => {
    if (sameSearchFilters(filters, nextFilters)) return;
    setDraft({ urlKey, q, filters: nextFilters });
  };

  return { q, filters, facets: localView.facets, resultCount, setQ, setFilters, results, loading, refining: isRefining, resultPresentation, error };
}
