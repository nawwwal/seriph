'use client';

import type { ReactNode } from 'react';
import ThemeSwitcher from '@/components/theme/ThemeSwitcher';
import ProfileMenu from '@/components/layout/ProfileMenu';

/** Shared status footer: optional metrics + theme + profile. */
export default function AppStatusStrip({ children }: { children?: ReactNode }) {
  return (
    <section
      aria-label="App status"
      className="flex h-full min-w-0 items-center gap-2 px-4 text-xs uppercase"
    >
      <div
        data-status-metrics
        className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain"
      >
        {children}
      </div>
      <div className="ml-auto flex h-full shrink-0 items-center gap-4 bg-[var(--paper)]">
        <ThemeSwitcher />
        <ProfileMenu />
      </div>
    </section>
  );
}
