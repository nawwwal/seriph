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
  ];
  if (pendingCount > 0) items.push(['Uploads', String(pendingCount)]);
  return (
    <section aria-label="Library status" className="flex h-full min-w-0 items-center gap-2 px-4 text-xs uppercase">
      <div data-status-metrics className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain">
        <dl className="flex min-w-max items-center gap-x-4 whitespace-nowrap pr-2">
          {items.map(([label, value]) => (
            <div key={label} className="flex items-baseline gap-1">
              <dt className="font-bold opacity-60">{label}</dt>
              <dd className="max-w-48 truncate font-black" title={value}>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="ml-auto flex h-full shrink-0 items-center gap-2 bg-[var(--paper)]">
        <ProfileMenu />
        <ThemeSwitcher />
      </div>
    </section>
  );
}
