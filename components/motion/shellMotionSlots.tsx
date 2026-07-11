'use client';

import { useMemo, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { buildBodyDepthVariants } from '@/lib/motion/buildBodyDepthVariants';
import { useWorkspaceNav } from '@/components/motion/WorkspaceNavContext';
import { useShellMotionParams } from '@/components/motion/ShellMotionParamsContext';

/**
 * Enter-only body depth (single route tree — no exit stack / no ghost catalogue).
 */
export function MotionBody({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const nav = useWorkspaceNav();
  const params = useShellMotionParams();

  const variants = useMemo(
    () =>
      buildBodyDepthVariants(
        {
          awayZ: params.depth.awayZ,
          nearZ: params.depth.nearZ,
          scaleAway: params.depth.scaleAway,
          scaleNear: params.depth.scaleNear,
        },
        {
          exitMs: params.timing.exitMs,
          enterMs: params.timing.enterMs,
          enterDelayMs: params.timing.enterDelayMs,
        },
      ),
    [
      params.depth.awayZ,
      params.depth.nearZ,
      params.depth.scaleAway,
      params.depth.scaleNear,
      params.timing.exitMs,
      params.timing.enterMs,
      params.timing.enterDelayMs,
    ],
  );

  if (reduce || nav === 'cross') {
    return (
      <div className="h-full min-h-0 min-w-0 w-full max-w-full overflow-auto">
        {children}
      </div>
    );
  }

  return (
    <div
      className="h-full min-h-0 min-w-0 w-full max-w-full"
      style={{ perspective: params.depth.perspectivePx }}
    >
      <motion.div
        className="h-full min-h-0 min-w-0 w-full max-w-full overflow-auto"
        custom={nav}
        variants={variants}
        initial="initial"
        animate="animate"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {children}
      </motion.div>
    </div>
  );
}

export function MotionSlot({
  show,
  id,
  className,
  children,
  delayEnter = false,
}: {
  show: boolean;
  id: string;
  className?: string;
  children: ReactNode;
  delayEnter?: boolean;
}) {
  const reduce = useReducedMotion();
  const params = useShellMotionParams();
  if (!show) return null;
  const enter = {
    duration: params.timing.enterMs / 1000,
    delay: delayEnter ? params.timing.actionsDelayMs / 1000 : 0,
    ease: [0.23, 1, 0.32, 1] as [number, number, number, number],
  };
  return (
    <motion.div
      key={id}
      className={className}
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : enter}
    >
      {children}
    </motion.div>
  );
}
