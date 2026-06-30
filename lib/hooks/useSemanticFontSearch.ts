'use client';

import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { searchFontsForUser } from '@/lib/search/searchApi';
import { searchFiltersKey } from '@/lib/search/searchFilterUrl';
import type { SearchFilters, SearchResultItem } from '@/models/search.models';

const REMOTE_SEARCH_DEBOUNCE_MS = 350;

interface SemanticSearchState {
  query: string;
  userId: string;
  results: SearchResultItem[];
  error: string | null;
  loading: boolean;
}

function abortError(error: unknown): boolean {
  return (error instanceof DOMException || error instanceof Error) && error.name === 'AbortError';
}

export function useSemanticFontSearch(query: string, user: User | null, filters: SearchFilters) {
  const [state, setState] = useState<SemanticSearchState | null>(null);
  const filtersKey = searchFiltersKey(filters);

  useEffect(() => {
    if (query.length < 3 || !user) return;

    let isActive = true;
    const controller = new AbortController();
    const searchUser = user;
    const timer = window.setTimeout(() => {
      if (!isActive) return;
      setState({ query, userId: searchUser.uid, results: [], error: null, loading: true });
      searchFontsForUser({
        getIdToken: () => searchUser.getIdToken(),
        query,
        filters,
        signal: controller.signal,
      })
        .then((results) => {
          if (isActive) setState({ query, userId: searchUser.uid, results, error: null, loading: false });
        })
        .catch((error: unknown) => {
          if (!isActive || abortError(error)) return;
          setState({
            query,
            userId: searchUser.uid,
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
  }, [filters, filtersKey, query, user]);

  return state;
}
