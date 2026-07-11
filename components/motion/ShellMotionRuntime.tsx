'use client';

import type { ReactNode } from 'react';
import { DialRoot } from 'dialkit';
import 'dialkit/styles.css';
import WorkspacePageTransition from '@/components/motion/WorkspacePageTransition';
import { useShellTransitionDials } from '@/components/motion/useShellTransitionDials';

/** Dev workspace: DialKit params feed the single-tree shell stage. */
export default function ShellMotionRuntime({ children }: { children: ReactNode }) {
  const dials = useShellTransitionDials();
  return (
    <>
      <WorkspacePageTransition params={dials}>{children}</WorkspacePageTransition>
      <DialRoot position="bottom-right" />
    </>
  );
}
