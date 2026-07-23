'use client';

import type { ReactNode } from 'react';
// import { DialRoot } from 'dialkit';
// import 'dialkit/styles.css';
import WorkspacePageTransition from '@/components/motion/WorkspacePageTransition';
// import { useShellTransitionDials } from '@/components/motion/useShellTransitionDials';

/** Single-tree shell stage. DialKit is paused while the interface is refined. */
export default function ShellMotionRuntime({ children }: { children: ReactNode }) {
  // const dials = useShellTransitionDials();
  return (
    <WorkspacePageTransition>
      {children}
      {/* <DialRoot position="bottom-right" /> */}
    </WorkspacePageTransition>
  );
}
