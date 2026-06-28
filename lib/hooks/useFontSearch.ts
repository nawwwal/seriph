'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { searchFontsForUser } from '@/lib/search/searchApi';

export interface SearchResultItem {
  id: string;
  slug: string;
  name: string;
  category: string;
  classification?: string;
  summary?: string;
  moods?: string[];
  styleCount: number;
  score?: number;
}

/** Drives the search field + results, auto-running whenever the URL `q` changes. */
export function useFontSearch() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const urlQuery = searchParams.get('q') ?? '';
  const trimmedUrlQuery = urlQuery.trim();
  const userId = user?.uid ?? null;
  const [inputState, setInputState] = useState({ urlQuery, q: urlQuery });
  const [searchState, setSearchState] = useState<{
    query: string;
    userId: string;
    results: SearchResultItem[];
    error: string | null;
  } | null>(null);

  if (inputState.urlQuery !== urlQuery) {
    setInputState({ urlQuery, q: urlQuery });
  }

  useEffect(() => {
    if (!trimmedUrlQuery || !user) return;

    let isActive = true;
    const searchUser = user;
    searchFontsForUser({
      getIdToken: () => searchUser.getIdToken(),
      query: trimmedUrlQuery,
    })
      .then((results) => {
        if (!isActive) return;
        setSearchState({ query: trimmedUrlQuery, userId: searchUser.uid, results, error: null });
      })
      .catch((err: unknown) => {
        if (!isActive) return;
        setSearchState({
          query: trimmedUrlQuery,
          userId: searchUser.uid,
          results: [],
          error: err instanceof Error ? err.message : 'Search failed',
        });
      });

    return () => {
      isActive = false;
    };
  }, [trimmedUrlQuery, user]);

  const hasCurrentSearchState = searchState?.query === trimmedUrlQuery && searchState.userId === userId;
  const results = trimmedUrlQuery && hasCurrentSearchState ? searchState.results : null;
  const loading = Boolean(trimmedUrlQuery && userId && !hasCurrentSearchState);
  const error = trimmedUrlQuery && hasCurrentSearchState ? searchState.error : null;

  return {
    q: inputState.q,
    setQ: (q: string) => setInputState((current) => ({ ...current, q })),
    results,
    loading,
    error,
  };
}
