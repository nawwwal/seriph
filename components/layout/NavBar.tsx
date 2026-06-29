'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import ThemeSwitcher from '@/components/theme/ThemeSwitcher';
import ProfileMenu from './ProfileMenu';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useUploads } from '@/lib/contexts/UploadContext';
import { notifySearchQueryChange, queryFromSearchEvent, searchHref, searchQueryChangedEvent } from '@/lib/search/searchRouteEvents';

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { activeCount, open: openUploadCenter } = useUploads();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const syncSearchQuery = () => {
      if (pathname !== '/search') return;
      setSearchQuery(new URLSearchParams(window.location.search).get('q') ?? '');
    };
    const syncFromSearchEvent = (event: Event) => {
      const query = queryFromSearchEvent(event);
      if (query !== null) setSearchQuery(query);
    };
    syncSearchQuery();
    window.addEventListener('popstate', syncSearchQuery);
    window.addEventListener(searchQueryChangedEvent, syncFromSearchEvent);
    return () => {
      window.removeEventListener('popstate', syncSearchQuery);
      window.removeEventListener(searchQueryChangedEvent, syncFromSearchEvent);
    };
  }, [pathname]);

  const handleSearchSubmit = (event: FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (query) {
      notifySearchQueryChange(query);
      router.push(searchHref(query));
    }
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
            <Link
              href="/login"
              className="inline-flex h-8 min-w-24 items-center justify-center uppercase font-bold rule px-3 rounded-[var(--radius)] text-sm leading-none btn-ink"
            >
              Sign in
            </Link>
          )}
          <ThemeSwitcher />
        </div>
      </div>
    </nav>
  );
}
