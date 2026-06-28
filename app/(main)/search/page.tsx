'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import NavBar from '@/components/layout/NavBar';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import SearchResultCard from '@/components/search/SearchResultCard';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useFontSearch } from '@/lib/hooks/useFontSearch';

function SearchView() {
  const router = useRouter();
  const { q, setQ, results, loading, error } = useFontSearch();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    if (trimmed) router.push(`/search?q=${encodeURIComponent(trimmed)}`);
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
        <button type="submit" disabled={loading} className="uppercase font-bold rule px-4 py-2 rounded-[var(--radius)] text-sm btn-ink ink-bg">
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
        {results?.map((r) => <SearchResultCard key={r.id} r={r} />)}
      </div>

      {results && results.length === 0 && !loading && (
        <p className="mt-6 text-sm opacity-60">Nothing matched. Try describing the feeling, not the name.</p>
      )}
    </main>
  );
}

function Gate({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-screen h-screen flex flex-col bg-[var(--paper)]">
      <NavBar />
      <div className="flex-1 flex items-center justify-center p-8">{children}</div>
    </div>
  );
}

export default function SearchPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <Gate><LoadingSpinner text="Loading Seriph…" size="large" /></Gate>;
  if (!user) {
    return (
      <Gate>
        <div className="text-center p-10 rule rounded-[var(--radius)] max-w-lg">
          <p className="text-xl mb-4">Sign in to search your type library.</p>
          <Link href="/" className="uppercase font-bold rule px-4 py-2 rounded-[var(--radius)] btn-ink inline-block">
            ← Back home
          </Link>
        </div>
      </Gate>
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
