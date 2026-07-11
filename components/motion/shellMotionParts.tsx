'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { LAYOUT } from '@/lib/motion/catalogDetailStoryboard';

type Move = { duration: number; ease?: [number, number, number, number] };

export function MotionHeader({
  className,
  children,
  move,
}: {
  className: string;
  children: ReactNode;
  move: Move;
}) {
  return (
    <motion.header
      layout
      layoutId={LAYOUT.header}
      data-home-header
      className={className}
      transition={move}
    >
      {children}
    </motion.header>
  );
}

export function MotionCanvas({
  className,
  children,
  move,
}: {
  className: string;
  children: ReactNode;
  move: Move;
}) {
  return (
    <motion.div layout data-catalog-canvas className={className} transition={move}>
      {children}
    </motion.div>
  );
}

export { MotionRail } from '@/components/motion/MotionRail';
export { MotionBody, MotionSlot } from '@/components/motion/shellMotionSlots';
