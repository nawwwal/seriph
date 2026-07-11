'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { TIMING, DEPTH } from '@/lib/motion/catalogDetailStoryboard';

/** Defaults when DialKit panel is not mounted (production). */
export const SHELL_MOTION_DEFAULTS = {
  timing: {
    moveMs: TIMING.moveMs,
    exitMs: TIMING.exitMs,
    enterMs: TIMING.enterMs,
    enterDelayMs: TIMING.enterDelayMs,
    actionsDelayMs: TIMING.actionsDelayMs,
    settleStartMs: TIMING.settleStartMs,
    staggerMs: TIMING.staggerMs,
    holdMs: TIMING.holdMs,
  },
  depth: {
    awayZ: DEPTH.awayZ,
    nearZ: DEPTH.nearZ,
    scaleAway: DEPTH.scaleAway,
    scaleNear: DEPTH.scaleNear,
    perspectivePx: DEPTH.perspectivePx,
  },
  shell: {
    railWidthRem: 20,
  },
} as const;

export type ShellMotionParams = {
  timing: {
    moveMs: number;
    exitMs: number;
    enterMs: number;
    enterDelayMs: number;
    actionsDelayMs: number;
    settleStartMs: number;
    staggerMs: number;
    holdMs: number;
  };
  depth: {
    awayZ: number;
    nearZ: number;
    scaleAway: number;
    scaleNear: number;
    perspectivePx: number;
  };
  shell: { railWidthRem: number };
};

const Ctx = createContext<ShellMotionParams>(SHELL_MOTION_DEFAULTS);

export function ShellMotionParamsProvider({
  value,
  children,
}: {
  value: ShellMotionParams;
  children: ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useShellMotionParams(): ShellMotionParams {
  return useContext(Ctx);
}
