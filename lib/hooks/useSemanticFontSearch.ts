'use client';

import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { searchFontsForUser } from '@/lib/search/searchApi';
import { buildSemanticSearchCacheKey, readPersistentSemanticSearch, writePersistentSemanticSearch } from '@/lib/search/persistentSemanticSearch';
import { searchFiltersKey } from '@/lib/search/searchFilterUrl';
import type { SearchFilters, SearchResultItem } from '@/models/search.models';

const REMOTE_SEARCH_DEBOUNCE_MS = 250;

interface SemanticSearchState {
  query: string;
  userId: string;
  filtersKey: string;
  libraryRevision: number;
  results: SearchResultItem[];
  error: string | null;
  loading: boolean;
}

function abortError(error: unknown): boolean {
  return (error instanceof DOMException || error instanceof Error) && error.name === 'AbortError';
}

export function useSemanticFontSearch(query: string, user: User | null, filters: SearchFilters, libraryRevision: number) {
  const [state, setState] = useState<SemanticSearchState | null>(null);
  const filtersKey = searchFiltersKey(filters);

  useEffect(() => {
    if (query.length < 3 || !user) return;

    let isActive = true;
    const controller = new AbortController();
    const searchUser = user;
    const cacheKey = buildSemanticSearchCacheKey({ libraryRevision, query, filters });
    const timer = window.setTimeout(() => {
      if (!isActive) return;
      setState({ query, userId: searchUser.uid, filtersKey, libraryRevision, results: [], error: null, loading: true });
      readPersistentSemanticSearch(searchUser.uid, cacheKey)
        .then(async (cached) => {
          if (cached) return cached;
          const results = await searchFontsForUser({ getIdToken: () => searchUser.getIdToken(), query, filters, signal: controller.signal });
          void writePersistentSemanticSearch(searchUser.uid, cacheKey, libraryRevision, results);
          return results;
        })
        .then((results) => {
          if (isActive) setState({ query, userId: searchUser.uid, filtersKey, libraryRevision, results, error: null, loading: false });
        })
        .catch((error: unknown) => {
          if (!isActive || abortError(error)) return;
          setState({
            query,
            userId: searchUser.uid,
            filtersKey,
            libraryRevision,
            results: [],
            error: error instanceof Error ? error.message : 'Search failed',
            loading: false,
          });
        });
    }, REMOTE_SEARCH_DEBOUNCE_MS);

    return () => {
      isActive = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [filters, filtersKey, libraryRevision, query, user]);

  return state;
}
