/**
 * ─────────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD — Catalogue ↔ Font detail
 *
 * Single route tree (no AnimatePresence page stack).
 * Dual stacks painted two catalogues through card gaps.
 *
 * Engine
 *   • layoutId: logo + header only
 *   • Rail: width 0↔rem (reverse starts closed)
 *   • Body: enter-only Z depth (forward +Z / back −Z)
 *   • DialKit (dev): ShellMotionRuntime → shared params
 *
 * Forward: shell morph + detail body enter from +Z
 * Back: shell reverse + catalog body enter from −Z
 * ─────────────────────────────────────────────────────────────
 */

export const TIMING = {
  moveMs: 220,
  exitMs: 260,
  enterMs: 260,
  enterDelayMs: 0,
  actionsDelayMs: 80,
  settleStartMs: 200,
  staggerMs: 40,
  holdMs: 280,
  crossfadeMs: 160,
} as const;

export const EASE = {
  out: [0.23, 1, 0.32, 1] as const,
  inOut: [0.77, 0, 0.175, 1] as const,
};

export const DEPTH = {
  awayZ: 64,
  nearZ: 48,
  scaleAway: 0.97,
  scaleNear: 0.98,
  perspectivePx: 1200,
} as const;

export const LAYOUT = {
  header: 'seriph-header',
  logo: 'seriph-logo',
} as const;

export const MOVE = {
  duration: TIMING.moveMs / 1000,
  ease: EASE.inOut,
} as const;

export const ENTER = {
  duration: TIMING.enterMs / 1000,
  ease: EASE.out,
} as const;

export const EXIT = {
  duration: TIMING.exitMs / 1000,
  ease: EASE.out,
} as const;

export const BODY_ENTER = {
  duration: TIMING.enterMs / 1000,
  delay: TIMING.enterDelayMs / 1000,
  ease: EASE.out,
} as const;

export const BODY_EXIT = {
  duration: TIMING.exitMs / 1000,
  ease: EASE.out,
} as const;

export const ACTIONS_ENTER = {
  duration: TIMING.enterMs / 1000,
  delay: TIMING.actionsDelayMs / 1000,
  ease: EASE.out,
} as const;

export const TRANSITION_TYPES = {
  forward: 'nav-forward',
  back: 'nav-back',
  openFamily: 'open-family',
} as const;

export const VT = LAYOUT;
