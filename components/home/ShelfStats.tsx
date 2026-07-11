'use client';

import type { ShelfStatsSummary } from '@/models/shelf.models';
import AppStatusStrip from '@/components/layout/AppStatusStrip';
import { TIMING } from '@/lib/motion/catalogDetailStoryboard';

interface ShelfStatsProps {
  stats: ShelfStatsSummary | null;
  pendingCount: number;
}

export default function ShelfStats({ stats, pendingCount }: ShelfStatsProps) {
  const familyCount = stats ? String(stats.familyCount) : '-';
  const styleCount = stats ? String(stats.styleCount) : '-';
  const recentFamily = stats?.recentFamilyName ?? '-';

  const items = [
    ['Families', familyCount],
    ['Styles', styleCount],
    ['Recent', recentFamily],
  ];
  if (pendingCount > 0) items.push(['Uploads', String(pendingCount)]);

  return (
    <AppStatusStrip>
      <dl className="flex min-w-max items-center gap-x-4 whitespace-nowrap pr-2">
        {items.map(([label, value], i) => (
          <div
            key={label}
            className="status-metric-enter flex items-baseline gap-1"
            style={{ animationDelay: `${i * TIMING.staggerMs}ms` }}
          >
            <dt className="font-bold opacity-60">{label}</dt>
            <dd className="max-w-48 truncate font-black" title={value}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </AppStatusStrip>
  );
}
