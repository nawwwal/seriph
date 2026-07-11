'use client';

import type { ShelfStatsSummary } from '@/models/shelf.models';
import ThemeSwitcher from '@/components/theme/ThemeSwitcher';
import ProfileMenu from '@/components/layout/ProfileMenu';

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
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <ProfileMenu />
        <ThemeSwitcher />
      </div>
    </section>
  );
}
