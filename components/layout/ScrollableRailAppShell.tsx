'use client';

import type { ReactNode } from 'react';
import HomeHeaderSearch from '@/components/home/HomeHeaderSearch';
import AppShellLogoLink from '@/components/layout/AppShellLogoLink';
import {
  MotionBody,
  MotionCanvas,
  MotionHeader,
  MotionRail,
  MotionSlot,
} from '@/components/motion/shellMotion';

type Move = {
  duration: number;
  ease?: [number, number, number, number];
};

/** Home layout whose logo and filters share one desktop scroll column. */
export default function ScrollableRailAppShell({
  children,
  move,
  sidebar,
}: {
  children: ReactNode;
  move: Move;
  sidebar: ReactNode;
}) {
  return (
    <div className="grid min-h-0 min-w-0 w-full flex-1 grid-cols-[auto_minmax(0,1fr)] grid-rows-[6rem_auto_minmax(0,1fr)] md:flex md:flex-row">
      <div className="contents md:flex md:h-full md:min-h-0 md:w-[var(--shell-rail-width)] md:shrink-0 md:flex-col md:overflow-x-hidden md:overflow-y-auto md:border-r md:border-[var(--ink)]">
        <div className="col-start-1 row-start-1 flex h-24 min-h-24 min-w-0 shrink-0 items-center border-b border-[var(--ink)] px-4 sm:px-6 md:border-b-0 md:px-6">
          <AppShellLogoLink
            compact={false}
            logoClassName="block w-[160px] max-w-full leading-none"
            move={move}
          />
        </div>
        <MotionRail
          open
          move={move}
          className="col-span-2 row-start-2 max-w-full overflow-x-hidden md:overflow-visible md:border-r-0 [&>div]:!w-full [&>div]:!min-w-0"
        >
          {sidebar}
        </MotionRail>
      </div>

      <div className="contents md:flex md:min-h-0 md:min-w-0 md:flex-1 md:flex-col">
        <MotionHeader
          className="col-start-2 row-start-1 flex h-16 min-h-16 min-w-0 items-center border-b border-[var(--ink)] px-4 sm:px-6"
          move={move}
        >
          <MotionSlot show id="header-search" className="relative min-w-0 flex-1">
            <HomeHeaderSearch />
          </MotionSlot>
        </MotionHeader>
        <MotionCanvas
          className="relative col-span-2 row-start-3 min-h-0 min-w-0 w-full max-w-full flex-1 overflow-hidden bg-[var(--paper)]"
          move={move}
        >
          <MotionBody>{children}</MotionBody>
        </MotionCanvas>
      </div>
    </div>
  );
}
