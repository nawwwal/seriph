'use client';

import type { ReactNode } from 'react';
import HomeHeaderSearch from '@/components/home/HomeHeaderSearch';
import AppShellLogoLink from '@/components/layout/AppShellLogoLink';
import { MotionHeader, MotionSlot } from '@/components/motion/shellMotion';

/**
 * Header height morphs via layout; search/actions are slot fades (not shared morph).
 */
export default function AppShellHeader({
  compact,
  headerActions,
  move = { duration: 0 },
  railOpen,
}: {
  compact: boolean;
  headerActions?: ReactNode;
  move?: { duration: number; ease?: [number, number, number, number] };
  railOpen: boolean;
}) {
  const height = compact
    ? 'h-10 min-h-10'
    : 'h-20 min-h-20 gap-4 sm:h-24 sm:min-h-24 sm:gap-6';

  if (!compact && railOpen) {
    return (
      <MotionHeader
        className={`flex w-full shrink-0 items-center gap-3 border-b border-[var(--ink)] px-4 sm:px-6 md:grid md:grid-cols-[var(--shell-rail-width)_minmax(0,1fr)] md:gap-0 md:border-b-0 md:px-0 ${height}`}
        move={move}
      >
        <div className="flex h-full min-w-0 items-center md:border-r md:border-[var(--ink)] md:px-6">
          <AppShellLogoLink compact={false} move={move} />
        </div>
        <div className="flex h-full min-w-0 flex-1 items-center md:border-b md:border-[var(--ink)] md:px-6">
          <MotionSlot show id="header-search" className="relative min-w-0 flex-1">
            <HomeHeaderSearch />
          </MotionSlot>
        </div>
      </MotionHeader>
    );
  }

  return (
    <MotionHeader
      className={`rule-b flex w-full shrink-0 items-center gap-3 px-4 sm:px-6 ${height}`}
      move={move}
    >
      <AppShellLogoLink compact={compact} move={move} />
      <MotionSlot show={!compact} id="header-search" className="relative min-w-0 flex-1">
        <HomeHeaderSearch />
      </MotionSlot>
      <MotionSlot
        show={Boolean(compact && headerActions)}
        id="header-actions"
        className="ml-auto flex min-w-0 items-center gap-2"
        delayEnter
      >
        {headerActions}
      </MotionSlot>
    </MotionHeader>
  );
}
