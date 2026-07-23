'use client';

import Link from 'next/link';
import type { MouseEvent } from 'react';
import SeriphLogo from '@/components/brand/SeriphLogo';

/** Logo home link — Framer layoutId on the mark handles size morph. */
export default function AppShellLogoLink({
  compact,
  move = { duration: 0 },
}: {
  compact: boolean;
  move?: { duration: number; ease?: [number, number, number, number] };
}) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const shelf = document.querySelector<HTMLElement>('[data-shelf-scroll-root="true"]');
    if (!shelf) return;

    event.preventDefault();
    shelf.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Link
      href="/"
      scroll={false}
      onClick={handleClick}
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
