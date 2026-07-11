'use client';

import Link from 'next/link';
import { Plus, RefreshCw } from 'lucide-react';
import NavSearch from '@/components/layout/NavSearch';
import ProfileMenu from '@/components/layout/ProfileMenu';
import ThemeSwitcher from '@/components/theme/ThemeSwitcher';
import { Button } from '@/components/ui/Button';
import { buttonClassName } from '@/components/ui/buttonStyles';
import { useUploads } from '@/lib/contexts/UploadContext';

interface HomeShellActionsProps {
  isEmpty: boolean;
  onAddFonts: () => void;
  onRegenerateCovers: () => void;
}

export default function HomeShellActions({
  isEmpty,
  onAddFonts,
  onRegenerateCovers,
}: HomeShellActionsProps) {
  const { activeCount, open: openUploadCenter } = useUploads();
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
      <Link href="/import" className={buttonClassName({ size: 'nav' })}>Import</Link>
      <NavSearch />
      <Button onClick={onAddFonts} size="navAction" className="inline-flex items-center gap-1" icon={<Plus size={14} aria-hidden="true" />}>
        Add Fonts
      </Button>
      {!isEmpty ? (
        <Button
          onClick={onRegenerateCovers}
          size="navAction"
          className="inline-flex items-center gap-1"
          icon={<RefreshCw size={14} aria-hidden="true" />}
        >
          Covers
        </Button>
      ) : null}
      <Button onClick={openUploadCenter} size="navAction" aria-label="Open upload center">
        Uploads{activeCount > 0 ? ` ${activeCount}` : ''}
      </Button>
      <ProfileMenu />
      <ThemeSwitcher />
    </div>
  );
}
