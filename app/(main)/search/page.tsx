'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import NavBar from '@/components/layout/NavBar';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/lib/contexts/AuthContext';

interface SearchResultItem {
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

function SearchView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';

  const [q, setQ] = useState(initialQuery);
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

  // Auto-run whenever the URL query changes (driven by the nav search field).
  useEffect(() => {
    const urlQuery = searchParams.get('q') ?? '';
    setQ(urlQuery);
    if (urlQuery.trim()) {
      runSearch(urlQuery);
    } else {
      setResults(null);
    }
  }, [searchParams, runSearch]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <main className="flex-1 w-full px-8 sm:px-10 md:px-12 lg:px-16 py-10 overflow-auto">
      <h1 className="cap-tight uppercase font-black tracking-tight text-[clamp(36px,5vw,64px)] leading-[0.9] mb-6">
        Find the right voice
      </h1>

      <form onSubmit={onSubmit} className="flex gap-2 max-w-2xl">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="warm geometric sans, something editorial, 90s ski poster…"
          className="flex-1 rule rounded-[var(--radius)] bg-[var(--paper)] px-4 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)]"
        />
        <button
          type="submit"
          disabled={loading}
          className="uppercase font-bold rule px-4 py-2 rounded-[var(--radius)] text-sm btn-ink ink-bg"
        >
          {loading ? '…' : 'Search'}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-[var(--danger)]">{error}</p>}

      {results && (
        <p className="mt-6 text-xs uppercase tracking-wide opacity-60">
          {results.length} result{results.length === 1 ? '' : 's'}
        </p>
      )}

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {results?.map((r) => (
          <Link
            key={r.id}
            href={`/family/${r.slug}`}
            className="block rule rounded-[var(--radius)] p-4 hover:ink-bg transition-colors"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-bold">{r.name}</span>
              <span className="text-xs uppercase opacity-60">{r.classification || r.category}</span>
            </div>
            {r.summary && <p className="mt-2 text-sm opacity-80 line-clamp-3">{r.summary}</p>}
            {r.moods && r.moods.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {r.moods.slice(0, 4).map((m) => (
                  <span key={m} className="text-xs rule px-2 py-0.5 rounded-full opacity-70">
                    {m}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-3 text-xs uppercase opacity-50">
              {r.styleCount} style{r.styleCount === 1 ? '' : 's'}
            </div>
          </Link>
        ))}
      </div>

      {results && results.length === 0 && !loading && (
        <p className="mt-6 text-sm opacity-60">
          Nothing matched. Try describing the feeling, not the name.
        </p>
      )}
    </main>
  );
}

export default function SearchPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="w-screen h-screen flex flex-col bg-[var(--paper)]">
        <NavBar />
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner text="Loading Seriph…" size="large" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="w-screen h-screen flex flex-col bg-[var(--paper)]">
        <NavBar />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center p-10 rule rounded-[var(--radius)] max-w-lg">
            <p className="text-xl mb-4">Sign in to search your type library.</p>
            <Link
              href="/"
              className="uppercase font-bold rule px-4 py-2 rounded-[var(--radius)] btn-ink inline-block"
            >
              ← Back home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col">
      <NavBar />
      <Suspense fallback={null}>
        <SearchView />
      </Suspense>
    </div>
  );
}
