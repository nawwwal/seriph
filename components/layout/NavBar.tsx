'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import ThemeSwitcher from '@/components/theme/ThemeSwitcher';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useUploads } from '@/lib/contexts/UploadContext';

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, signInWithGoogle, signOut } = useAuth();
  const { activeCount, open: openUploadCenter } = useUploads();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [avatarFailed, setAvatarFailed] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  // Reset the avatar fallback when the signed-in user changes.
  useEffect(() => {
    setAvatarFailed(false);
  }, [user?.photoURL]);

  // Keep the nav field in sync with the active search query (client-only read
  // avoids forcing a Suspense boundary on every page that renders the NavBar).
  useEffect(() => {
    if (pathname === '/search' && typeof window !== 'undefined') {
      setSearchQuery(new URLSearchParams(window.location.search).get('q') ?? '');
    }
  }, [pathname]);

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(path);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };

    if (isProfileMenuOpen) {
      window.addEventListener('mousedown', handleClickOutside);
    } else {
      window.removeEventListener('mousedown', handleClickOutside);
    }

    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileMenuOpen]);

  useEffect(() => {
    setIsProfileMenuOpen(false);
  }, [user]);

  return (
    <nav className="w-full rule-b bg-[var(--paper)] sticky top-0 z-10">
      <div className="w-full px-8 sm:px-10 md:px-12 lg:px-16 py-3 flex gap-2 items-center">
        {user ? (
          <>
            <Link
              href="/"
              className={`uppercase font-bold rule px-3 py-1 rounded-[var(--radius)] text-sm transition-colors ${
                isActive('/') && !pathname.includes('family') && !pathname.includes('import')
                  ? 'btn-ink ink-bg'
                  : 'btn-ink'
              }`}
            >
              Shelf
            </Link>
            <Link
              href="/import"
              className={`uppercase font-bold rule px-3 py-1 rounded-[var(--radius)] text-sm transition-colors ${
                isActive('/import') ? 'btn-ink ink-bg' : 'btn-ink'
              }`}
            >
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
            <button
              onClick={openUploadCenter}
              className="relative uppercase font-bold rule px-3 py-1 rounded-[var(--radius)] text-sm btn-ink"
              aria-label="Open upload center"
            >
              Uploads
              {activeCount > 0 && (
                <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 flex items-center justify-center text-[10px] font-bold rounded-full bg-[var(--accent)] text-[var(--paper)]">
                  {activeCount}
                </span>
              )}
            </button>
          )}
          {user ? (
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                className="flex items-center justify-center w-8 h-8 rounded-full rule overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ink)] transition"
                aria-haspopup="true"
                aria-expanded={isProfileMenuOpen}
              >
                {user.photoURL && !avatarFailed ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    width={32}
                    height={32}
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarFailed(true)}
                    className="w-8 h-8 object-cover"
                  />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-xs font-bold uppercase">
                    {(user.displayName || 'U').charAt(0).toUpperCase()}
                  </span>
                )}
              </button>
              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-3 w-44 rounded-[var(--radius)] bg-[var(--paper)] rule shadow-lg overflow-hidden z-20">
                  <div className="px-3 py-2 text-xs uppercase font-bold tracking-wide opacity-70">
                    {user.displayName || user.email || 'Account'}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      signOut();
                    }}
                    className="w-full text-left uppercase font-bold text-sm px-3 py-2 btn-ink rule-t hover:ink-bg transition"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => signInWithGoogle()}
              className="uppercase font-bold rule px-3 py-1 rounded-[var(--radius)] text-sm btn-ink"
              disabled={isLoading}
            >
              Sign in
            </button>
          )}
          <ThemeSwitcher />
        </div>
      </div>
    </nav>
  );
}
