'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import ThemeSwitcher from '@/components/theme/ThemeSwitcher';
import { useAuth } from '@/lib/contexts/AuthContext';

export default function NavBar() {
  const pathname = usePathname();
  const { user, isLoading, signInWithGoogle, signOut } = useAuth();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

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
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                className="flex items-center justify-center w-8 h-8 rounded-full rule overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ink)] transition"
                aria-haspopup="true"
                aria-expanded={isProfileMenuOpen}
              >
                {user.photoURL ? (
                  <Image
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    width={32}
                    height={32}
                    className="w-8 h-8 object-cover"
                    priority={false}
                    unoptimized
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
