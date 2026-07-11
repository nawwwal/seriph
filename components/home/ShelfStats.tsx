import type { ShelfStatsSummary } from '@/models/shelf.models';
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

  const items = [
    ['Families', familyCount],
    ['Styles', styleCount],
    ['Recent', recentFamily],
    ['Uploads', String(pendingCount)],
  ];
  return (
    <section aria-label="Library status" className="flex min-h-10 min-w-0 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-1 text-xs uppercase">
      <dl className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1">
        {items.map(([label, value]) => (
          <div key={label} className="flex min-w-0 items-baseline gap-1">
            <dt className="font-bold opacity-60">{label}</dt>
            <dd className="max-w-48 truncate font-black" title={value}>{value}</dd>
          </div>
        ))}
      </dl>
      <div role="group" aria-label="Shelf mode" className="ml-auto flex shrink-0 items-center gap-1">
        <Button aria-pressed={shelfMode === 'spines'} onClick={() => setShelfMode('spines')} size="filterTiny" tone={shelfMode === 'spines' ? 'active' : 'default'}>Spines</Button>
        <Button aria-pressed={shelfMode === 'covers'} onClick={() => setShelfMode('covers')} size="filterTiny" tone={shelfMode === 'covers' ? 'active' : 'default'}>Covers</Button>
      </div>
    </section>
  );
}
