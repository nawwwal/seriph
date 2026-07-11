'use client';

import { useRef, type ReactNode } from 'react';
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

/**
 * Single route tree only — never stack two pages.
 * Dual pages caused catalogue bleed through card gaps.
 * Body enter depth + shell layout still run inside AppShell.
 */
export default function WorkspacePageTransition({ children, params }: Props) {
  const pathname = usePathname() || '/';
  const reduce = useReducedMotion();
  const prevPath = useRef(pathname);
  const navRef = useRef<WorkspaceNav>('cross');

  if (prevPath.current !== pathname) {
    navRef.current = workspaceNavDirection(prevPath.current, pathname);
    prevPath.current = pathname;
  }

  const nav = navRef.current;
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
