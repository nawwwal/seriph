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
}: {
  compact: boolean;
  headerActions?: ReactNode;
  move?: { duration: number; ease?: [number, number, number, number] };
}) {
  const height = compact
    ? 'h-10 min-h-10'
    : 'h-20 min-h-20 gap-4 sm:h-24 sm:min-h-24 sm:gap-6';

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
