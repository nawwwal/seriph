import type { Variants } from 'framer-motion';
import type { WorkspaceNav } from '@/lib/motion/workspaceNavDirection';

export type DepthDialValues = {
  awayZ: number;
  nearZ: number;
  scaleAway: number;
  scaleNear: number;
};

export type TimingDialValues = {
  exitMs: number;
  enterMs: number;
  enterDelayMs: number;
};

const easeOut = [0.23, 1, 0.32, 1] as const;

/** Build GPU-only vertical enter/exit variants (no 3D perspective/reflow). */
export function buildBodyDepthVariants(
  _depth: DepthDialValues,
  timing: TimingDialValues,
): Variants {
  const enterSec = Math.min(0.2, (timing.enterMs || 160) / 1000);
  const exitSec = Math.min(0.16, (timing.exitMs || 140) / 1000);
  const tEnter = { duration: enterSec, delay: timing.enterDelayMs / 1000, ease: easeOut };
  const tExit = { duration: exitSec, ease: easeOut };

  return {
    initial: (nav: WorkspaceNav) => {
      if (nav === 'forward') return { opacity: 0, transform: 'translateY(6px)' };
      if (nav === 'back') return { opacity: 0, transform: 'translateY(-4px)' };
      return { opacity: 1, transform: 'translateY(0px)' };
    },
    animate: {
      opacity: 1,
      transform: 'translateY(0px)',
      transition: tEnter,
    },
    exit: (nav: WorkspaceNav) => ({
      opacity: 0,
      transform: nav === 'back' ? 'translateY(4px)' : 'translateY(0px)',
      transition: tExit,
    }),
  };
}
