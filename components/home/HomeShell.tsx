import type { ReactNode } from 'react';
import Link from 'next/link';
import SeriphLogo from '@/components/brand/SeriphLogo';

interface HomeShellProps {
  alphabetRail: ReactNode;
  catalogCanvas: ReactNode;
  statusStrip: ReactNode;
}

export default function HomeShell({
  alphabetRail,
  catalogCanvas,
  statusStrip,
}: HomeShellProps) {
  return (
    <section data-home-shell className="flex-1 min-h-0 min-w-0 w-full overflow-hidden p-5">
      <div className="rule flex h-full min-h-0 min-w-0 w-full flex-col overflow-hidden rounded-[13px] bg-[var(--paper)]">
        <header
          data-home-header
          className="rule-b flex h-24 shrink-0 items-center px-6"
        >
          <Link href="/" scroll={false} aria-label="Seriph shelf" className="shrink-0 theme-focus-ring">
            <SeriphLogo className="w-[193px]" label="Seriph" />
          </Link>
        </header>
        <div className="grid min-h-0 min-w-0 w-full flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[368px_minmax(0,1fr)] md:grid-rows-1">
          <aside data-alphabet-rail className="min-w-0 w-full overflow-hidden border-b border-[var(--ink)] md:border-b-0 md:border-r">
            {alphabetRail}
          </aside>
          <div data-catalog-canvas className="min-h-0 min-w-0 w-full max-w-full overflow-hidden">
            {catalogCanvas}
          </div>
        </div>
        <footer data-status-strip className="h-10 min-h-10 shrink-0 overflow-hidden border-t border-[var(--ink)] md:h-10">
          {statusStrip}
        </footer>
      </div>
    </section>
  );
}
