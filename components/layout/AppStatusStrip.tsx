'use client';

import type { ReactNode } from 'react';
import { ArrowUpFromLine } from 'lucide-react';
import ThemeSwitcher from '@/components/theme/ThemeSwitcher';
import ProfileMenu from '@/components/layout/ProfileMenu';
import UploadTray from '@/components/upload/UploadTray';
import { Button } from '@/components/ui/Button';
import { useUploads } from '@/lib/contexts/UploadContext';

/** Shared status footer: optional metrics + theme + profile. */
export default function AppStatusStrip({ children }: { children?: ReactNode }) {
  const { openImport } = useUploads();

  return (
    <section
      aria-label="App status"
      className="relative flex h-full min-w-0 items-center gap-1 px-2 sm:gap-2 sm:px-4 text-xs uppercase"
    >
      <div
        data-status-metrics
        className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain"
      >
        {children}
      </div>
      <div className="ml-auto flex h-full shrink-0 items-center bg-[var(--paper)]">
        <div className="flex items-center">
          <UploadTray />
        </div>
        <Button
          onClick={openImport}
          size="textIcon"
          icon={<ArrowUpFromLine size={14} aria-hidden="true" />}
          className="ml-1 min-h-11 sm:min-h-0 h-full shrink-0 border-l border-[var(--ink)] px-2 sm:ml-4 sm:px-4"
        >
          Import
        </Button>
        <div className="btn-ink flex h-full shrink-0 items-center border-l border-[var(--ink)] px-2 sm:px-4 transition-colors [&>button]:bg-transparent [&>button]:text-inherit">
          <ThemeSwitcher />
        </div>
        <div className="btn-ink -mr-2 sm:-mr-4 flex h-full shrink-0 items-center border-l border-[var(--ink)] px-2 sm:px-4 transition-colors [&>button]:bg-transparent [&>button]:text-inherit">
          <ProfileMenu />
        </div>
      </div>
    </section>
  );
}
