/**
 * ─────────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD — Theme switch (soft token cross-fade)
 *
 * Not View Transitions (full-page snapshots hung the roller).
 * Cross-fade *feel* via equal ease-in-out interpolation of color
 * tokens — old press dissolves into the new on every surface that
 * uses var(--paper)/var(--ink).
 *
 * Preview (roller face lands in visor)
 *    0ms      data-theme → candidate (DOM only, no React storm)
 *    0–200ms  all color tokens ease-in-out (equal blend both ways)
 *
 * Commit (select)
 *    0ms      data-theme → chosen, persist
 *    0–240ms  same curve, slightly longer so the choice settles
 *
 * Why this isn’t a “brick”
 *    • duration long enough for large chroma jumps (not 100ms slam)
 *    • ease-in-out = cross-fade character (in + out together)
 *    • only @property colors on <html> — no layout, no snapshots
 *    • skip paint when theme unchanged
 *
 * Reduced motion → 0ms
 * ─────────────────────────────────────────────────────────────
 */

export const THEME_SWITCH = {
  /** Roller scrub — soft dissolve */
  previewMs: 200,
  /** Intentional pick — a touch longer */
  commitMs: 240,
  /** Cross-fade character for color morph */
  ease: 'ease-in-out',
} as const;
