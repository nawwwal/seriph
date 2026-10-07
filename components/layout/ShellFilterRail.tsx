'use client';

import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { MotionRail } from '@/components/motion/MotionRail';

/** Keep filters available without letting the rail consume the phone canvas. */
export default function ShellFilterRail({ children, move, className = '', railClassName = '' }: {
  children: ReactNode;
  move: { duration: number; ease?: [number, number, number, number] };
  className?: string;
  railClassName?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  return (
    <div className={`relative z-30 min-h-0 min-w-0 shrink-0 lg:contents ${className}`}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={id}
        onClick={() => setExpanded(!expanded)}
        className="theme-focus-ring flex min-h-11 w-full items-center gap-2 border-b border-[var(--ink)] px-4 text-xs font-bold uppercase btn-ink lg:hidden"
      >
        <SlidersHorizontal size={16} aria-hidden />
        Filters
        <ChevronDown size={16} aria-hidden className={`ml-auto transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      <div id={id} className={`${expanded ? 'block' : 'hidden'} absolute inset-x-0 top-full lg:contents`}>
        <MotionRail open move={move} className={`mobile-filter-rail max-h-[40dvh] !w-full !basis-auto overflow-y-auto lg:max-h-none lg:!w-[var(--shell-rail-width)] lg:!basis-[var(--shell-rail-width)] lg:overflow-hidden ${railClassName}`}>
          {children}
        </MotionRail>
      </div>
    </div>
  );
}
