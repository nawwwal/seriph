'use client';

import type { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import NavBar from './NavBar';
import WorkspacePageTransition from '@/components/motion/WorkspacePageTransition';

const ShellMotionRuntime = dynamic(
  () => import('@/components/motion/ShellMotionRuntime'),
  { ssr: false },
);

/**
 * Root frame.
 * - Auth loading: neutral full-viewport shell.
 * - Signed-in: single route tree + shell stage (no dual-page stack).
 * - Public: document scroll + NavBar.
 */
export default function AppFrame({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const isSignedInWorkspace = Boolean(user) && pathname !== '/login';
  const isDev = process.env.NODE_ENV === 'development';

  if (isLoading) {
    return (
      <div
        data-app-frame="loading"
        className="flex h-screen flex-col overflow-hidden bg-[var(--paper)]"
      >
        {children}
      </div>
    );
  }

  if (isSignedInWorkspace) {
    return (
      <div
        data-app-frame="workspace"
        className="flex h-screen flex-col overflow-hidden"
      >
        {isDev ? (
          <ShellMotionRuntime>{children}</ShellMotionRuntime>
        ) : (
          <WorkspacePageTransition>{children}</WorkspacePageTransition>
        )}
      </div>
    );
  }

  return (
    <div data-app-frame="public" className="flex min-h-screen flex-col">
      <NavBar />
      {children}
    </div>
  );
}
