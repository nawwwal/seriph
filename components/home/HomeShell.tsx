import type { ReactNode } from 'react';
import SeriphLogo from '@/components/brand/SeriphLogo';

interface HomeShellProps {
  headerActions: ReactNode;
  alphabetRail: ReactNode;
  catalogCanvas: ReactNode;
  statusStrip: ReactNode;
}

export default function HomeShell({
  headerActions,
  alphabetRail,
  catalogCanvas,
  statusStrip,
}: HomeShellProps) {
  return (
    <section data-home-shell className="flex-1 min-h-0 w-full overflow-hidden p-5">
      <div className="rule flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--radius)] bg-[var(--paper)]">
        <header
          data-home-header
          className="rule-b flex shrink-0 flex-wrap items-center gap-4 px-5 py-3 md:h-24 md:flex-nowrap md:py-0"
        >
          <SeriphLogo className="w-28 shrink-0 md:w-36" label="Seriph" />
          <div className="min-w-0 flex-1">{headerActions}</div>
        </header>
        <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[368px_minmax(0,1fr)] md:grid-rows-1">
          <aside data-alphabet-rail className="border-b border-[var(--ink)] md:border-b-0 md:border-r">
            {alphabetRail}
          </aside>
          <div data-catalog-canvas className="min-h-0 min-w-0 overflow-hidden">
            {catalogCanvas}
          </div>
        </div>
        <footer data-status-strip className="border-t border-[var(--ink)] min-h-10 shrink-0">
          {statusStrip}
        </footer>
      </div>
    </section>
  );
}
