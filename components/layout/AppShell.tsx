'use client';

import type { ReactNode } from 'react';
import AppStatusStrip from '@/components/layout/AppStatusStrip';
import AppShellHeader from '@/components/layout/AppShellHeader';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useUploads } from '@/lib/contexts/UploadContext';
import { Button } from '@/components/ui/Button';
import {
  MotionBody,
  MotionCanvas,
  MotionRail,
  useShellMove,
} from '@/components/motion/shellMotion';

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
  const { user } = useAuth();
  const { openImport } = useUploads();
  const railOpen = Boolean(sidebar);
  const move = useShellMove({ compact, railOpen });

  return (
    <section
      data-app-shell
      data-home-shell
      data-shell-density={density}
      data-rail={railOpen ? 'open' : 'collapsed'}
      className="flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden p-2 sm:p-3 md:p-5"
    >
      <div className="rule flex h-full min-h-0 min-w-0 w-full flex-col overflow-hidden rounded-[10px] sm:rounded-[13px] bg-[var(--paper)]">
        <AppShellHeader
          compact={compact}
          headerActions={headerActions ?? (user ? <Button onClick={openImport} size="sm">Import</Button> : undefined)}
          move={move}
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
          className="h-10 min-h-10 shrink-0 overflow-hidden border-t border-[var(--ink)] bg-[var(--paper)]"
        >
          {statusStrip ?? <AppStatusStrip />}
        </footer>
      </div>
    </section>
  );
}
