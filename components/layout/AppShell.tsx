'use client';

import type { CSSProperties, ReactNode } from 'react';
import AppStatusStrip from '@/components/layout/AppStatusStrip';
import AppShellHeader from '@/components/layout/AppShellHeader';
import {
  MotionBody,
  MotionCanvas,
  MotionRail,
  useShellMove,
} from '@/components/motion/shellMotion';
import { useShellMotionParams } from '@/components/motion/ShellMotionParamsContext';

interface AppShellProps {
  sidebar?: ReactNode;
  children: ReactNode;
  statusStrip?: ReactNode;
  headerActions?: ReactNode;
  density?: 'default' | 'compact';
}

/** Single-tree shell. Canvas is opaque paper (no ghost catalogue under cards). */
export default function AppShell({
  sidebar,
  children,
  statusStrip,
  headerActions,
  density = 'default',
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
        <AppShellHeader
          compact={compact}
          headerActions={headerActions}
          move={move}
          railOpen={railOpen}
        />

        <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col md:flex-row">
          <MotionRail open={railOpen} move={move}>
            {sidebar}
          </MotionRail>

          <MotionCanvas
            className="relative min-h-0 min-w-0 w-full max-w-full flex-1 overflow-hidden bg-[var(--paper)]"
            move={move}
          >
            <MotionBody>{children}</MotionBody>
          </MotionCanvas>
        </div>

        <footer
          data-status-strip
          className="h-10 min-h-10 shrink-0 overflow-visible border-t border-[var(--ink)] bg-[var(--paper)]"
        >
          {statusStrip ?? <AppStatusStrip />}
        </footer>
      </div>
    </section>
  );
}
