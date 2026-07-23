import type { ReactNode } from 'react';
import AppShell from '@/components/layout/AppShell';

interface HomeShellProps {
  alphabetRail: ReactNode;
  catalogCanvas: ReactNode;
  statusStrip: ReactNode;
}

/** Shelf composition on the shared signed-in AppShell. */
export default function HomeShell({
  alphabetRail,
  catalogCanvas,
  statusStrip,
}: HomeShellProps) {
  return (
    <AppShell sidebar={alphabetRail} statusStrip={statusStrip} scrollSidebarWithLogo>
      {catalogCanvas}
    </AppShell>
  );
}
