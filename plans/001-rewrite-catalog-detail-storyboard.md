# 001 — Rewrite catalogue↔detail storyboard + VT timeline tokens

- **Status**: DONE
- **Commit**: ca4b9a1
- **Severity**: HIGH
- **Category**: Cohesion & tokens / Missed opportunities (orchestration)
- **Estimated scope**: 2 files (`lib/motion/catalogDetailStoryboard.ts`, `styles/view-transitions.css`), ~80 lines

## Problem

The storyboard claims a staged sequence, but every track starts at ~0ms with only a 70ms body enter delay. There is no real film order. Tokens use a weak ease-in-out and an explicit ease-in (blocked on UI).

Current storyboard (`lib/motion/catalogDetailStoryboard.ts:17-28`):

```ts
 * Forward · transitionTypes: nav-forward | open-family
 * ─────────────────────────────────────────────────
 *     0ms  snapshots: header (tall+search), logo, rail, canvas, body
 *   0–240ms HEADER share morph  h-20/24 → h-10  (ease-in-out)
 *           LOGO share morph    wordmark → compact mark
 *           RAIL exit           slide left + fade  (ease-in, 200ms)
 *           CANVAS share morph  right column → full width (ease-in-out)
 *   0–200ms BODY exit           soft fade out (ease-out)
 *  80–300ms BODY enter          soft fade in  (ease-out, delayed)
```

Current tokens (`lib/motion/catalogDetailStoryboard.ts:40-49` and `styles/view-transitions.css:6-14`):

```ts
export const TIMING = {
  moveMs: 300,
  exitMs: 200,
  enterMs: 260,
  enterDelayMs: 70,
} as const;
```

```css
:root {
  --vt-duration-exit: 200ms;
  --vt-duration-enter: 260ms;
  --vt-duration-enter-delay: 70ms;
  --vt-duration-move: 300ms;
  --vt-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --vt-ease-in: cubic-bezier(0.4, 0, 1, 1);
  --vt-ease-in-out: cubic-bezier(0.45, 0.05, 0.55, 0.95);
}
```

Rail exit uses ease-in (`styles/view-transitions.css:77-79`):

```css
::view-transition-old(.rail-collapse) {
  animation: var(--vt-duration-exit) var(--vt-ease-in) both vt-rail-x reverse;
}
```

## Target

Replace the storyboard + tokens with a **four-phase film** (forward). Total deliberate UI budget stays ≤ ~320ms wall-clock (shell phases overlap; no single track > 280ms).

```
/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD — Catalogue → Font detail (forward)
 *
 * Spatial idea: the app frame stays; chrome compresses, rail
 * yields, body hands off, detail settles.
 *
 * Engine: experimental.viewTransition + <Link transitionTypes>
 *         React <ViewTransition name | share | enter | exit>
 *         Never document.startViewTransition + await
 *
 * Forward · types: nav-forward | open-family
 * ─────────────────────────────────────────────────
 *     0ms  capture snapshots
 *
 * PHASE 1 · CHROME COMPRESS          0–200ms
 *     0ms  LOGO share morph          wordmark → compact (ease-out, 200ms)
 *     0ms  HEADER HEIGHT group       h-20/24 → h-10 (ease-in-out, 220ms)
 *     0ms  SEARCH exit               fade + slight up (ease-out, 160ms)
 *    80ms  ACTIONS enter             fade in (ease-out, 160ms, delay 80ms)
 *
 * PHASE 2 · RAIL YIELDS              40–240ms
 *    40ms  RAIL exit                 slide left + fade (ease-out, 200ms)
 *    40ms  CANVAS share morph        expand to full width (ease-in-out, 220ms)
 *
 * PHASE 3 · BODY HANDOFF             80–300ms
 *    80ms  BODY exit complete        fade out (ease-out, 160ms from 0)
 *   100ms  BODY enter starts         fade + 1.5px blur clear (ease-out, 200ms)
 *
 * PHASE 4 · DETAIL SETTLE            after VT / on mount (plan 004)
 *   180ms  status metrics stagger    40ms between items
 *   200ms  detail sections stagger   title → specimen → panels
 *
 * Back · types: nav-back — reverse phases (plan 005)
 * Reduced motion: opacity-only crossfades ≤ 120ms; no translate/scale
 * ───────────────────────────────────────────────────────── */
```

Exact tokens to write:

```ts
// lib/motion/catalogDetailStoryboard.ts
export const TIMING = {
  /** Logo / header height / canvas width morph */
  moveMs: 220,
  /** Search, rail, body leave */
  exitMs: 160,
  /** Actions, rail (back), body arrive */
  enterMs: 200,
  /** New body waits for old body to clear */
  enterDelayMs: 100,
  /** Rail + canvas start after chrome begins */
  railDelayMs: 40,
  /** Compact header actions after search clears */
  actionsDelayMs: 80,
  /** Post-nav detail settle (CSS/JS, not VT group) */
  settleStartMs: 180,
  /** Stagger between status metrics / detail blocks */
  staggerMs: 40,
} as const;
```

```css
/* styles/view-transitions.css :root */
:root {
  --vt-duration-exit: 160ms;
  --vt-duration-enter: 200ms;
  --vt-duration-enter-delay: 100ms;
  --vt-duration-move: 220ms;
  --vt-duration-rail-delay: 40ms;
  --vt-duration-actions-delay: 80ms;
  /* strong ease-out for enter/exit — AUDIT.md */
  --vt-ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  /* strong ease-in-out for on-screen morphs — AUDIT.md */
  --vt-ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  /* drawer-like for rail horizontal yield — AUDIT.md */
  --vt-ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
}
```

**Delete `--vt-ease-in`.** No plan may reintroduce ease-in on UI.

Update every consumer of the deleted token in this file so rail uses `--vt-ease-drawer` or `--vt-ease-out` (exact wiring in plan 003).

Keep `VT` names and `TRANSITION_TYPES` keys stable unless plan 002 renames header semantics.

## Repo conventions to follow

- Storyboard lives only in `lib/motion/catalogDetailStoryboard.ts` (ASCII block + `TIMING` + `VT` + `TRANSITION_TYPES`).
- CSS custom properties mirror `TIMING` in `styles/view-transitions.css` (already imported from `app/globals.css`).
- Interface Craft pattern: right-aligned ms, `→` for value transitions, single source of timing truth.
- Exemplar of a storyboarded module in-repo: `lib/motion/themeSwitchStoryboard.ts`.

## Steps

1. Rewrite the top comment in `lib/motion/catalogDetailStoryboard.ts` to the PHASE 1–4 storyboard above (forward only; note back → plan 005).
2. Replace `TIMING` with the object in Target. Export it (already exported).
3. Update `:root` tokens in `styles/view-transitions.css` to match Target. Remove `--vt-ease-in`.
4. Temporarily map existing rules that referenced `--vt-ease-in` to `--vt-ease-out` so the tree still builds (plan 003 will refine rail to drawer curve).
5. Align existing duration vars used by `::view-transition-group(*)`, logo, canvas, content-fade to the new names/values (do not invent new selectors yet; plans 002–004 add those).
6. Keep reduced-motion block, but change comment in storyboard to say “opacity-only, ≤120ms” — full reduced-motion refinement is optional follow-up; do not zero-out only if you also add a gentler opacity path in the same PR. Minimum acceptable: keep current 0s nuke if you lack time, note it in the plan PR as residual.

## Boundaries

- Do NOT change React components, `share`/`enter`/`exit` maps, or route `transitionTypes` in this plan.
- Do NOT implement header decomposition, rail delays, or detail stagger here (002–004).
- Do NOT add dependencies.
- Do NOT exceed the 100 non-empty line lint per file (`npm run lint:lines`). If the storyboard comment pushes the TS file over, split constants into `lib/motion/catalogDetailTiming.ts` and re-export from the storyboard file.

## Verification

- **Mechanical**:
  - `npm run lint:lines`
  - `npx tsc --noEmit` or `npm run typecheck`
  - `rg "vt-ease-in" styles lib components` → no matches
- **Feel check**: not required yet (tokens only); confirm storyboard comment matches TIMING keys.
- **Done when**: TIMING and CSS vars are identical in intent; storyboard lists four phases; ease-in token gone.
