'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

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
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const [results, setResults] = useState<SearchResultItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Search failed');
      setResults(Array.isArray(data?.results) ? data.results : []);
    } catch (err: any) {
      setError(err?.message || 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const urlQuery = searchParams.get('q') ?? '';
    setQ(urlQuery);
    if (urlQuery.trim()) runSearch(urlQuery);
    else setResults(null);
  }, [searchParams, runSearch]);

  return { q, setQ, results, loading, error };
}
