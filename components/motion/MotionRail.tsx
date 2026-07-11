'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { peekShellSnap } from '@/lib/motion/shellContinuity';
import { useShellMotionParams } from '@/components/motion/ShellMotionParamsContext';

type Move = { duration: number; ease?: [number, number, number, number] };

/**
 * Rail width 0 ↔ rem. Reverse (detail→catalog) starts closed then opens
 * so the canvas never full-bleeds under a delayed rail.
 */
export function MotionRail({
  open,
  children,
  move,
}: {
  open: boolean;
  className?: string;
  children: ReactNode;
  move: Move;
}) {
  const reduce = useReducedMotion();
  const params = useShellMotionParams();
  const from = useMemo(() => peekShellSnap(), []);
  const rem = params.shell.railWidthRem;

  const [paintOpen, setPaintOpen] = useState(() => {
    if (open && from && !from.railOpen) return false;
    if (!open && from && from.railOpen) return true;
    return open;
  });

  useEffect(() => {
    setPaintOpen(open);
  }, [open]);

  const transition = reduce ? { duration: 0 } : move;
  const width = paintOpen ? `${rem}rem` : 0;

  return (
    <motion.aside
      data-app-sidebar
      data-alphabet-rail
      aria-hidden={paintOpen ? undefined : true}
      className={
        paintOpen
          ? 'min-w-0 shrink-0 overflow-hidden border-b border-[var(--ink)] bg-[var(--paper)] md:border-b-0 md:border-r'
          : 'pointer-events-none min-w-0 shrink-0 overflow-hidden border-0 p-0'
      }
      initial={false}
      animate={{ width, opacity: paintOpen ? 1 : 0 }}
      transition={transition}
      style={{ flexBasis: width }}
    >
      <div
        className="h-full min-h-0 w-full"
        style={{ width: `${rem}rem`, minWidth: `${rem}rem` }}
      >
        {children}
      </div>
    </motion.aside>
  );
}
