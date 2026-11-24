'use client';

import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { EASE } from '@/lib/motion/catalogDetailStoryboard';
import { cn } from '@/lib/utils/cn';

type Move = { duration: number; ease?: [number, number, number, number] };

/** Fixed-width sidebar rail using GPU-only transform + opacity (zero width/flexBasis reflow). */
export function MotionRail({
  open,
  className,
  children,
  move,
}: {
  open: boolean;
  className?: string;
  children: ReactNode;
  move: Move;
}) {
  const reduce = useReducedMotion();
  if (!open) return null;

  const duration = reduce ? 0 : Math.min(0.18, move.duration ?? 0.16);

  return (
    <motion.aside
      data-app-sidebar
      data-alphabet-rail
      className={cn(
        'min-w-0 w-[var(--shell-rail-width)] shrink-0 overflow-hidden border-b border-[var(--ink)] bg-[var(--paper)] lg:border-b-0 lg:border-r',
        className,
      )}
      initial={reduce ? false : { opacity: 0, transform: 'translateX(-8px)' }}
      animate={{ opacity: 1, transform: 'translateX(0px)' }}
      transition={{ duration, ease: EASE.out }}
    >
      <div className="h-full min-h-0 w-full">
        {children}
      </div>
    </motion.aside>
  );
}
