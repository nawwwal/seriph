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

/** Build body Z variants from live DialKit values. */
export function buildBodyDepthVariants(
  depth: DepthDialValues,
  timing: TimingDialValues,
): Variants {
  const zAway = `translateZ(-${depth.awayZ}px) scale(${depth.scaleAway})`;
  const zNear = `translateZ(${depth.nearZ}px) scale(${depth.scaleNear})`;
  const zFlat = 'translateZ(0px) scale(1)';
  const tExit = { duration: timing.exitMs / 1000, ease: easeOut };
  const tEnter = {
    duration: timing.enterMs / 1000,
    delay: timing.enterDelayMs / 1000,
    ease: easeOut,
  };

  return {
    initial: (nav: WorkspaceNav) => {
      if (nav === 'forward') return { opacity: 0, transform: zNear };
      if (nav === 'back') return { opacity: 0, transform: zAway };
      return { opacity: 1, transform: zFlat };
    },
    animate: {
      opacity: 1,
      transform: zFlat,
      transition: tEnter,
    },
    exit: (nav: WorkspaceNav) => {
      if (nav === 'forward') {
        return { opacity: 0, transform: zAway, transition: tExit };
      }
      if (nav === 'back') {
        return { opacity: 0, transform: zNear, transition: tExit };
      }
      return {
        opacity: 0,
        transform: zFlat,
        transition: { duration: 0.16, ease: easeOut },
      };
    },
  };
}
