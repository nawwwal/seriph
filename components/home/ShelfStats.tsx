import type { ShelfStatsSummary } from '@/models/shelf.models';
import Stat from '@/components/ui/Stat';
import { Button } from '@/components/ui/Button';

interface ShelfStatsProps {
  stats: ShelfStatsSummary | null;
  pendingCount: number;
  shelfMode: 'spines' | 'covers';
  setShelfMode: (mode: 'spines' | 'covers') => void;
}

export default function ShelfStats({ stats, pendingCount, shelfMode, setShelfMode }: ShelfStatsProps) {
  const familyCount = stats ? String(stats.familyCount) : '-';
  const styleCount = stats ? String(stats.styleCount) : '-';
  const recentFamily = stats?.recentFamilyName ?? '-';

  return (
    <section className="mt-4 sm:mt-6 md:mt-8 rule-t rule-b">
      <div className="grid grid-cols-2 sm:grid-cols-5">
        <Stat label="Families" value={familyCount} />
        <Stat label="Styles" value={styleCount} />
        <Stat label="Recently Added" value={recentFamily} />
        <Stat label="Uploads In Progress" value={pendingCount} />
        <div className="p-3 sm:p-4">
          <div className="uppercase text-xs sm:text-sm font-bold opacity-80">Shelf Mode</div>
          <div className="flex gap-2 mt-1">
            <Button onClick={() => setShelfMode('spines')} size="sm" tone={shelfMode === 'spines' ? 'active' : 'default'}>Spines</Button>
            <Button onClick={() => setShelfMode('covers')} size="sm" tone={shelfMode === 'covers' ? 'active' : 'default'}>Covers</Button>
          </div>
        </div>
      </div>
    </section>
  );
}
