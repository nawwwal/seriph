'use client';

import type { CSSProperties, ReactNode } from 'react';
import AppStatusStrip from '@/components/layout/AppStatusStrip';
import AppShellHeader from '@/components/layout/AppShellHeader';
import ShellFilterRail from '@/components/layout/ShellFilterRail';
import ScrollableRailAppShell from '@/components/layout/ScrollableRailAppShell';
import {
  MotionBody,
  MotionCanvas,
  useShellMove,
} from '@/components/motion/shellMotion';
import { useShellMotionParams } from '@/components/motion/ShellMotionParamsContext';

interface AppShellProps {
  sidebar?: ReactNode;
  children: ReactNode;
  statusStrip?: ReactNode;
  headerActions?: ReactNode;
  density?: 'default' | 'compact';
  scrollSidebarWithLogo?: boolean;
}

/** Single-tree shell. Canvas is opaque paper (no ghost catalogue under cards). */
export default function AppShell({
  sidebar,
  children,
  statusStrip,
  headerActions,
  density = 'default',
  scrollSidebarWithLogo = false,
}: AppShellProps) {
  const compact = density === 'compact';
  const railOpen = Boolean(sidebar);
  const move = useShellMove({ compact, railOpen });
  const railWidthRem = useShellMotionParams().shell.railWidthRem;
  const shellStyle = {
    '--shell-rail-width': `${railWidthRem}rem`,
  } as CSSProperties;

  return (
    <section
      data-app-shell
      data-home-shell
      data-shell-density={density}
      data-rail={railOpen ? 'open' : 'collapsed'}
      className="flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden p-2 sm:p-3 md:p-5"
      style={shellStyle}
    >
      <div className="rule flex h-full min-h-0 min-w-0 w-full flex-col overflow-hidden rounded-[10px] sm:rounded-[13px] bg-[var(--paper)]">
        {scrollSidebarWithLogo && railOpen ? (
          <ScrollableRailAppShell move={move} sidebar={sidebar}>
            {children}
          </ScrollableRailAppShell>
        ) : (
          <>
            <AppShellHeader
              compact={compact}
              headerActions={headerActions}
              move={move}
              railOpen={railOpen}
            />

            <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col lg:flex-row">
              {railOpen && <ShellFilterRail move={move}>{sidebar}</ShellFilterRail>}

              <MotionCanvas
                className="relative min-h-0 min-w-0 w-full max-w-full flex-1 overflow-hidden bg-[var(--paper)]"
                move={move}
              >
                <MotionBody>{children}</MotionBody>
              </MotionCanvas>
            </div>
          </>
        )}

        <footer
          data-status-strip
          className="min-h-12 shrink-0 sm:h-10 sm:min-h-10 overflow-visible border-t border-[var(--ink)] bg-[var(--paper)]"
        >
          {statusStrip ?? <AppStatusStrip />}
        </footer>
      </div>
    </section>
  );
}
