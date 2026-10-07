'use client';

import type { ReactNode } from 'react';
import HomeHeaderSearch from '@/components/home/HomeHeaderSearch';
import ShellFilterRail from '@/components/layout/ShellFilterRail';
import AppShellLogoLink from '@/components/layout/AppShellLogoLink';
import {
  MotionBody,
  MotionCanvas,
  MotionHeader,
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
    <div className="grid min-h-0 min-w-0 w-full flex-1 grid-cols-1 grid-rows-[3.5rem_3.5rem_auto_minmax(0,1fr)] lg:flex lg:flex-row">
      <div className="seriph-scrollbar contents lg:flex lg:h-full lg:min-h-0 lg:w-[var(--shell-rail-width)] lg:shrink-0 lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto lg:border-r lg:border-[var(--ink)]">
        <div className="col-start-1 row-start-1 flex h-14 min-h-14 lg:h-24 lg:min-h-24 min-w-0 shrink-0 items-center border-b border-[var(--ink)] px-4 sm:px-6 lg:border-b-0 lg:px-6">
          <AppShellLogoLink
            compact={false}
            logoClassName="block w-[112px] lg:w-[160px] max-w-full leading-none"
            move={move}
          />
        </div>
        <ShellFilterRail move={move} className="col-start-1 row-start-3" railClassName="lg:!basis-auto lg:overflow-visible lg:border-r-0 [&>div]:!w-full [&>div]:!min-w-0">
          {sidebar}
        </ShellFilterRail>
      </div>

      <div className="contents lg:flex lg:min-h-0 lg:min-w-0 lg:flex-1 lg:flex-col">
        <MotionHeader
          className="relative z-40 col-start-1 row-start-2 flex h-14 min-h-14 lg:h-16 lg:min-h-16 min-w-0 items-center border-b border-[var(--ink)] px-4 sm:px-6"
          move={move}
        >
          <MotionSlot show id="header-search" className="relative min-w-0 flex-1">
            <HomeHeaderSearch />
          </MotionSlot>
        </MotionHeader>
        <MotionCanvas
          className="relative col-start-1 row-start-4 min-h-0 min-w-0 w-full max-w-full flex-1 overflow-hidden bg-[var(--paper)]"
          move={move}
        >
          <MotionBody>{children}</MotionBody>
        </MotionCanvas>
      </div>
    </div>
  );
}
