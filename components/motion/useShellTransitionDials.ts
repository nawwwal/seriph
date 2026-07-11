'use client';

import { useDialKit } from 'dialkit';
import { SHELL_MOTION_DEFAULTS } from '@/components/motion/ShellMotionParamsContext';

/** DialKit panel — only call from ShellMotionRuntime / DialRoot. */
export function useShellTransitionDials() {
  const d = SHELL_MOTION_DEFAULTS;
  return useDialKit(
    'Shell transition',
    {
      timing: {
        moveMs: [d.timing.moveMs, 0, 800, 10],
        exitMs: [d.timing.exitMs, 0, 800, 10],
        enterMs: [d.timing.enterMs, 0, 800, 10],
        enterDelayMs: [d.timing.enterDelayMs, 0, 400, 10],
        actionsDelayMs: [d.timing.actionsDelayMs, 0, 400, 10],
        settleStartMs: [d.timing.settleStartMs, 0, 800, 10],
        staggerMs: [d.timing.staggerMs, 0, 160, 5],
        holdMs: [d.timing.holdMs, 0, 800, 10],
      },
      depth: {
        awayZ: [d.depth.awayZ, 0, 240, 1],
        nearZ: [d.depth.nearZ, 0, 240, 1],
        scaleAway: [d.depth.scaleAway, 0.85, 1, 0.005],
        scaleNear: [d.depth.scaleNear, 0.85, 1, 0.005],
        perspectivePx: [d.depth.perspectivePx, 400, 4000, 50],
      },
      shell: {
        railWidthRem: [d.shell.railWidthRem, 12, 28, 0.5],
      },
    },
    { id: 'seriph-shell-transition', persist: true },
  );
}
