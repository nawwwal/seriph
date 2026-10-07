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
    : 'h-28 min-h-28 gap-2 lg:h-24 lg:min-h-24 lg:gap-6';

  if (!compact && railOpen) {
    return (
      <MotionHeader
        className={`relative z-40 flex flex-col lg:flex-row w-full shrink-0 items-stretch lg:items-center gap-2 border-b border-[var(--ink)] px-4 sm:px-6 lg:grid lg:grid-cols-[var(--shell-rail-width)_minmax(0,1fr)] lg:gap-0 lg:border-b-0 lg:px-0 ${height}`}
        move={move}
      >
        <div className="flex h-12 lg:h-full min-w-0 items-center lg:border-r lg:border-[var(--ink)] lg:px-6">
          <AppShellLogoLink compact={false} move={move} />
        </div>
        <div className="flex min-h-0 lg:h-full min-w-0 flex-1 items-center lg:border-b lg:border-[var(--ink)] lg:px-6">
          <MotionSlot show id="header-search" className="relative min-w-0 flex-1">
            <HomeHeaderSearch />
          </MotionSlot>
        </div>
      </MotionHeader>
    );
  }

  return (
    <MotionHeader
      className={`relative z-40 rule-b flex w-full shrink-0 items-center gap-3 px-4 sm:px-6 ${height}`}
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
