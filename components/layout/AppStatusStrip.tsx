'use client';

import type { ReactNode } from 'react';
import ThemeSwitcher from '@/components/theme/ThemeSwitcher';
import ProfileMenu from '@/components/layout/ProfileMenu';
import UploadTray from '@/components/upload/UploadTray';

/** Shared status footer: optional metrics + theme + profile. */
export default function AppStatusStrip({ children }: { children?: ReactNode }) {
  return (
    <section
      aria-label="App status"
      className="relative flex h-full min-w-0 items-center gap-2 px-4 text-xs uppercase"
    >
      <div
        data-status-metrics
        className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain"
      >
        {children}
      </div>
      <div className="ml-auto flex h-full shrink-0 items-center gap-4 bg-[var(--paper)]">
        <UploadTray />
        <ThemeSwitcher />
        <ProfileMenu />
      </div>
    </section>
  );
}
