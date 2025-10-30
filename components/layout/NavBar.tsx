'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import ThemeSwitcher from '@/components/theme/ThemeSwitcher';
import { useAuth } from '@/lib/contexts/AuthContext';

export default function NavBar() {
  const pathname = usePathname();
  const { user, isLoading, signInWithGoogle, signOut } = useAuth();

  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(path);
  };

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
            <>
              <button
                onClick={() => signOut()}
                className="uppercase font-bold rule px-3 py-1 rounded-[var(--radius)] text-sm btn-ink"
              >
                Sign out
              </button>
              {user.photoURL ? (
                <Image
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  width={32}
                  height={32}
                  className="w-8 h-8 rounded-full rule object-cover"
                  priority={false}
                  unoptimized
                />
              ) : (
                <div className="w-8 h-8 rounded-full rule flex items-center justify-center text-xs font-bold">
                  {(user.displayName || 'U').charAt(0).toUpperCase()}
                </div>
              )}
            </>
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
