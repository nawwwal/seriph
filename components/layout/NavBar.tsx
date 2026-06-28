'use client';

import { Suspense, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ThemeSwitcher from '@/components/theme/ThemeSwitcher';
import ProfileMenu from './ProfileMenu';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useUploads } from '@/lib/contexts/UploadContext';

export default function NavBar() {
  return (
    <Suspense fallback={<NavBarFallback />}>
      <NavBarContent />
    </Suspense>
  );
}

function NavBarContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading, signInWithGoogle } = useAuth();
  const { activeCount, open: openUploadCenter } = useUploads();
  const [searchQuery, setSearchQuery] = useState('');
  const urlSearchQuery = pathname === '/search' ? searchParams.get('q') ?? '' : null;
  const [syncedUrlSearchQuery, setSyncedUrlSearchQuery] = useState<string | null>(urlSearchQuery);

  if (syncedUrlSearchQuery !== urlSearchQuery) {
    setSyncedUrlSearchQuery(urlSearchQuery);
    setSearchQuery(urlSearchQuery ?? '');
  }

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (query) router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  const isActive = (path: string) => (path === '/' ? pathname === '/' : pathname.startsWith(path));
  const shelfActive = isActive('/') && !pathname.includes('family') && !pathname.includes('import');

  return (
    <nav className="w-full rule-b bg-[var(--paper)] sticky top-0 z-10">
      <div className="w-full px-8 sm:px-10 md:px-12 lg:px-16 py-3 flex gap-2 items-center">
        {user ? (
          <>
            <Link href="/" className={`uppercase font-bold rule px-3 py-1 rounded-[var(--radius)] text-sm transition-colors ${shelfActive ? 'btn-ink ink-bg' : 'btn-ink'}`}>
              Shelf
            </Link>
            <Link href="/import" className={`uppercase font-bold rule px-3 py-1 rounded-[var(--radius)] text-sm transition-colors ${isActive('/import') ? 'btn-ink ink-bg' : 'btn-ink'}`}>
              Import
            </Link>
            <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md ml-1">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by mood, intent, vibe…"
                aria-label="Search your type library"
                className="w-full rule rounded-[var(--radius)] bg-[var(--paper)] px-3 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)]"
              />
            </form>
          </>
        ) : (
          <span className="uppercase font-black tracking-tight text-lg">Seriph</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {user && (
            <button onClick={openUploadCenter} className="relative uppercase font-bold rule px-3 py-1 rounded-[var(--radius)] text-sm btn-ink" aria-label="Open upload center">
              Uploads
              {activeCount > 0 && (
                <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 flex items-center justify-center text-[10px] font-bold rounded-full bg-[var(--accent)] text-[var(--paper)]">
                  {activeCount}
                </span>
              )}
            </button>
          )}
          {user ? (
            <ProfileMenu />
          ) : (
            <button onClick={() => signInWithGoogle()} className="uppercase font-bold rule px-3 py-1 rounded-[var(--radius)] text-sm btn-ink" disabled={isLoading}>
              Sign in
            </button>
          )}
          <ThemeSwitcher />
        </div>
      </div>
    </nav>
  );
}

function NavBarFallback() {
  return (
    <nav className="w-full rule-b bg-[var(--paper)] sticky top-0 z-10">
      <div className="w-full px-8 sm:px-10 md:px-12 lg:px-16 py-3 flex gap-2 items-center">
        <span className="uppercase font-black tracking-tight text-lg">Seriph</span>
        <div className="ml-auto flex items-center gap-2">
          <ThemeSwitcher />
        </div>
      </div>
    </nav>
  );
}
