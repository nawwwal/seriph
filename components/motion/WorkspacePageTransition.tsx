'use client';

import { useState, type ReactNode } from 'react';
import { LayoutGroup, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import {
  workspaceNavDirection,
  type WorkspaceNav,
} from '@/lib/motion/workspaceNavDirection';
import { WorkspaceNavProvider } from '@/components/motion/WorkspaceNavContext';
import {
  ShellMotionParamsProvider,
  SHELL_MOTION_DEFAULTS,
  type ShellMotionParams,
} from '@/components/motion/ShellMotionParamsContext';

type Props = {
  children: ReactNode;
  /** Live DialKit values when provided by ShellMotionRuntime */
  params?: ShellMotionParams;
};

type PathNav = {
  path: string;
  nav: WorkspaceNav;
};

/**
 * Single route tree only — never stack two pages.
 * Dual pages caused catalogue bleed through card gaps.
 * Body enter depth + shell layout still run inside AppShell.
 */
export default function WorkspacePageTransition({ children, params }: Props) {
  const pathname = usePathname() || '/';
  const reduce = useReducedMotion();
  const [pathNav, setPathNav] = useState<PathNav>({
    path: pathname,
    nav: 'cross',
  });

  // Adjust state when the route changes (React-approved render-time setState).
  if (pathname !== pathNav.path) {
    setPathNav({
      path: pathname,
      nav: workspaceNavDirection(pathNav.path, pathname),
    });
  }

  const nav = pathNav.path === pathname ? pathNav.nav : 'cross';
  const value = params ?? SHELL_MOTION_DEFAULTS;

  return (
    <ShellMotionParamsProvider value={value}>
      <LayoutGroup id="seriph-shell">
        <WorkspaceNavProvider nav={nav}>
          <div
            className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--paper)]"
            data-workspace-stage
            data-nav={nav}
            data-reduce-motion={reduce ? 'true' : undefined}
          >
            {children}
          </div>
        </WorkspaceNavProvider>
      </LayoutGroup>
    </ShellMotionParamsProvider>
  );
}
