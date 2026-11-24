'use client';

import type { ReactNode } from 'react';

type Move = { duration: number; ease?: [number, number, number, number] };

export function MotionHeader({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
  move?: Move;
}) {
  return (
    <header data-home-header className={className}>
      {children}
    </header>
  );
}

export function MotionCanvas({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
  move?: Move;
}) {
  return (
    <div data-catalog-canvas className={className}>
      {children}
    </div>
  );
}

export { MotionRail } from '@/components/motion/MotionRail';
export { MotionBody, MotionSlot } from '@/components/motion/shellMotionSlots';
