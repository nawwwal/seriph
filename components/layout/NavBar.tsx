'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import ThemeSwitcher from '@/components/theme/ThemeSwitcher';
import ProfileMenu from './ProfileMenu';
import NavSearch from './NavSearch';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useUploads } from '@/lib/contexts/UploadContext';
import { Button } from '@/components/ui/Button';
import { buttonClassName } from '@/components/ui/buttonStyles';
import SeriphLogo from '@/components/brand/SeriphLogo';

export default function NavBar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { openImport } = useUploads();

  const isActive = (path: string) => (path === '/' ? pathname === '/' : pathname.startsWith(path));
  const shelfActive = isActive('/') && !pathname.includes('family');

  return (
    <nav className="w-full rule-b bg-[var(--paper)] sticky top-0 z-10">
      <div className="w-full px-4 sm:px-10 md:px-12 lg:px-16 py-3 flex flex-wrap gap-2 items-center">
        {user ? (
          <>
            <Link href="/" scroll={false} className={buttonClassName({ size: 'nav', tone: shelfActive ? 'active' : 'default' })}>
              Shelf
            </Link>
            <Button onClick={openImport} size="nav">
              Import
            </Button>
            <NavSearch />
          </>
        ) : (
          <SeriphLogo className="w-24" label="Seriph" />
        )}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {user ? (
            <ProfileMenu />
          ) : (
            <Link
              href="/login"
              className={buttonClassName({ size: 'navLink' })}
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
