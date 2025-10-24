'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import ThemeSwitcher from '@/components/theme/ThemeSwitcher';

export default function NavBar() {
  const pathname = usePathname();

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
        <div className="ml-auto">
          <ThemeSwitcher />
        </div>
      </div>
    </nav>
  );
}

