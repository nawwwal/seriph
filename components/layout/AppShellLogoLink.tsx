'use client';

import Link from 'next/link';
import SeriphLogo from '@/components/brand/SeriphLogo';

/** Logo home link — Framer layoutId on the mark handles size morph. */
export default function AppShellLogoLink({
  compact,
  move = { duration: 0 },
}: {
  compact: boolean;
  move?: { duration: number; ease?: [number, number, number, number] };
}) {
  return (
    <Link
      href="/"
      scroll={false}
      aria-label="Seriph shelf"
      className="inline-flex h-full shrink-0 items-center leading-none theme-focus-ring"
    >
      <SeriphLogo
        compact={compact}
        move={move}
        className={
          compact ? 'block w-14 sm:w-16 leading-none' : 'block w-[140px] sm:w-[193px]'
        }
        label="Seriph"
      />
    </Link>
  );
}
