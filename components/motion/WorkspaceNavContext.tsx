'use client';

import { createContext, useContext } from 'react';
import type { WorkspaceNav } from '@/lib/motion/workspaceNavDirection';

const WorkspaceNavContext = createContext<WorkspaceNav>('cross');

export function WorkspaceNavProvider({
  nav,
  children,
}: {
  nav: WorkspaceNav;
  children: React.ReactNode;
}) {
  return (
    <WorkspaceNavContext.Provider value={nav}>
      {children}
    </WorkspaceNavContext.Provider>
  );
}

export function useWorkspaceNav(): WorkspaceNav {
  return useContext(WorkspaceNavContext);
}
