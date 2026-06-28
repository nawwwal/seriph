import type { FontFamily } from '@/models/font.models';
import Stat from '@/components/ui/Stat';

interface ShelfStatsProps {
  families: FontFamily[];
  pendingCount: number;
  shelfMode: 'spines' | 'covers';
  setShelfMode: (mode: 'spines' | 'covers') => void;
}

export default function ShelfStats({ families, pendingCount, shelfMode, setShelfMode }: ShelfStatsProps) {
  const totalStyles = families.reduce((sum, family) => sum + family.fonts.length, 0);
  const recentFamily = families.length > 0 ? families[0].name : '—';
  const modeBtn = (mode: 'spines' | 'covers') =>
    `uppercase text-xs font-bold rule px-2 py-1 rounded-[var(--radius)] ${shelfMode === mode ? 'ink-bg' : 'btn-ink'}`;

  return (
    <section className="mt-4 sm:mt-6 md:mt-8 rule-t rule-b">
      <div className="grid grid-cols-2 sm:grid-cols-5">
        <Stat label="Families" value={families.length} />
        <Stat label="Styles" value={totalStyles} />
        <Stat label="Recently Added" value={recentFamily} />
        <Stat label="Uploads In Progress" value={pendingCount} />
        <div className="p-3 sm:p-4">
          <div className="uppercase text-xs sm:text-sm font-bold opacity-80">Shelf Mode</div>
          <div className="flex gap-2 mt-1">
            <button onClick={() => setShelfMode('spines')} className={modeBtn('spines')}>Spines</button>
            <button onClick={() => setShelfMode('covers')} className={modeBtn('covers')}>Covers</button>
          </div>
        </div>
      </div>
    </section>
  );
}
