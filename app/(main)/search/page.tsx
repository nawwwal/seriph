'use client';

import { useState } from 'react';
import Link from 'next/link';

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

export default function SearchPage() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResultItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query }),
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
  }

  return (
    <main className="w-full px-8 sm:px-10 md:px-12 lg:px-16 py-10">
      <h1 className="uppercase font-bold text-2xl mb-6">Search</h1>

      <form onSubmit={runSearch} className="flex gap-2 max-w-2xl">
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

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

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
        <p className="mt-6 text-sm opacity-60">No matches. Try a different description.</p>
      )}
    </main>
  );
}
