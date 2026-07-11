'use client';

import { useEffect, useMemo } from 'react';
import { useReducedMotion } from 'framer-motion';
import {
  commitShellSnap,
  peekShellSnap,
  shellGeometryChanged,
  type ShellSnap,
} from '@/lib/motion/shellContinuity';
import { useShellMotionParams } from '@/components/motion/ShellMotionParamsContext';

export {
  MotionBody,
  MotionCanvas,
  MotionHeader,
  MotionRail,
  MotionSlot,
} from '@/components/motion/shellMotionParts';

/** Geometry move from shared params (or instant). */
export function useShellMove(to: ShellSnap) {
  const reduce = useReducedMotion();
  const params = useShellMotionParams();
  const from = useMemo(() => peekShellSnap(), []);
  const compact = to.compact;
  const railOpen = to.railOpen;
  const changed = shellGeometryChanged(from, { compact, railOpen });

  useEffect(() => {
    commitShellSnap({ compact, railOpen });
  }, [compact, railOpen]);

  if (reduce || !changed) return { duration: 0 };
  return {
    duration: params.timing.moveMs / 1000,
    ease: [0.77, 0, 0.175, 1] as [number, number, number, number],
  };
}
