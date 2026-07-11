# 005 — Reverse path parity (detail → catalogue)

- **Status**: DONE
- **Commit**: ca4b9a1
- **Severity**: HIGH
- **Category**: Interruptibility & timing / Cohesion (direction-aware)
- **Estimated scope**: 3–4 files (storyboard comment, `view-transitions.css`, `sharedTransition.tsx` maps, `AppShellLogoLink` / any back controls)

## Problem

User report: reverse (font family → catalogue) is **worse** than forward.

Causes:

1. Forward was already unstaged; reverse is the same mess inverted without intentional ordering.
2. Back is only tagged on the logo link (`AppShellLogoLink.tsx:19` `transitionTypes={[TRANSITION_TYPES.back]}`). Browser back / gesture may carry **no** type → enter/exit maps hit `default: 'none'` for rail/content while shared morphs still run → asymmetric half-animation.
3. Rail expand + canvas shrink + header grow + search reappear all fight if delays only exist on forward-oriented rules.
4. Header actions vanish and search pops with no reverse of plan 002 staging.

## Target

### Storyboard — Back (`nav-back`)

```
/* Back · transitionTypes: nav-back
 * ─────────────────────────────────────────────────
 *     0ms  capture
 *
 * PHASE B1 · DETAIL RECEDES           0–160ms
 *     0ms  BODY exit (detail)         fade out ease-out 160ms
 *     0ms  STATUS metrics exit        fade 120ms
 *     0ms  ACTIONS exit               fade up 160ms
 *
 * PHASE B2 · CHROME EXPANDS           40–260ms
 *    40ms  HEADER HEIGHT              h-10 → h-20/24 ease-in-out 220ms
 *    40ms  LOGO morph                 compact → wordmark ease-out 200ms
 *    80ms  SEARCH enter               fade down-in ease-out 200ms
 *
 * PHASE B3 · RAIL RETURNS             60–280ms
 *    60ms  RAIL enter                 from -16% + fade ease-out 200ms
 *    60ms  CANVAS morph               shrink width ease-in-out 220ms
 *
 * PHASE B4 · SHELF SETTLE             optional
 *   160ms  catalogue grid cards       existing shelf-card-enter OK
 */
```

### CSS direction

Where forward used delays on “new” detail pieces, back needs delays on “new” catalogue pieces:

| Pseudo | Class | Back behavior |
| --- | --- | --- |
| old | `header-actions-exit` | immediate fade (0 delay) |
| new | `header-search-enter` | delay 80ms |
| new | `rail-expand` | delay 60ms (`--vt-duration-rail-delay` or new `--vt-duration-rail-back-delay: 60ms`) |
| group | `seriph-canvas` | delay 60ms on back — **problem**: CSS cannot read transitionTypes |

**Limitation:** pure CSS `::view-transition-*` selectors cannot branch on `transitionTypes`. React applies **different classes** via enter/exit maps — that is the branch.

So:

```tsx
const railEnter = {
  [TRANSITION_TYPES.back]: 'rail-expand',
  default: 'none',
};

// content can stay content-fade both ways, OR:
const contentEnter = {
  [TRANSITION_TYPES.forward]: 'content-fade',
  [TRANSITION_TYPES.openFamily]: 'content-fade',
  [TRANSITION_TYPES.back]: 'content-fade-back',
  default: 'none',
};
const contentExit = {
  [TRANSITION_TYPES.forward]: 'content-fade',
  [TRANSITION_TYPES.openFamily]: 'content-fade',
  [TRANSITION_TYPES.back]: 'content-fade-back',
  default: 'none',
};
```

```css
/* Back body: new catalogue can use same fade with delay */
::view-transition-old(.content-fade-back) {
  animation: var(--vt-duration-exit) var(--vt-ease-out) both vt-fade reverse;
}
::view-transition-new(.content-fade-back) {
  animation: var(--vt-duration-enter) var(--vt-ease-out) var(--vt-duration-enter-delay) both vt-fade;
}
```

For canvas delay on back only: use a **different share class** if React allows `share` as a map — check React `ViewTransition` API at your React version. If `share` is string-only, keep one canvas morph without delay on back (snappier reverse is OK — **asymmetric**: reverse may start rail earlier). Prefer:

- Forward: rail/canvas delayed 40ms (chrome first).
- Back: rail/canvas at 0–40ms (body exits first via content-fade delay on new).

### Browser back button

Document in storyboard:

> Browser chrome back does not pass `transitionTypes`. Shared logo/header/canvas morphs still run; rail enter/exit classes may be `none`. Acceptable residual: logo+canvas morph without rail class animation. Optional follow-up: `popstate` listener calling `router.push('/', { transitionTypes: ['nav-back'] })` is **out of scope** unless already patterned in the app.

Ensure every **in-app** back control uses `transitionTypes={[TRANSITION_TYPES.back]}`:

- `AppShellLogoLink` (already)
- Any “← Back to Shelf” links on error states in `family/[familyId]/page.tsx` (currently plain `Link` without types — **add them**)

```tsx
<Link href="/" transitionTypes={[TRANSITION_TYPES.back]} ...>
```

### Interruptibility

Rapid click logo then a cover mid-transition: View Transitions should abort/replace. Do not add JS locks. Do not use non-interruptible long keyframes on the live shelf.

## Repo conventions to follow

- `TRANSITION_TYPES.back` from storyboard.
- `navigateWithViewTransition(..., { direction: 'back' })` already sets back types (`lib/motion/navigateWithViewTransition.ts:24-26`) — use it for programmatic backs.
- Exemplar Link types: `AppShellLogoLink.tsx`.

## Steps

1. Extend storyboard comment with Back phases (after 001–004 forward is real).
2. Add `content-fade-back` maps if forward/back need different delays; else verify content-fade is acceptable both ways.
3. Wire header search/actions enter/exit maps for back (plan 002 classes).
4. Add `transitionTypes={['nav-back']}` (via `TRANSITION_TYPES.back`) to family page fallback links.
5. Feel-tune rail-expand delay so canvas shrink and rail enter share an edge (no white gap, no double overlap > 1 frame at full speed).
6. Confirm logo back morph is not delayed behind a none-typed navigation when using the logo link.

## Boundaries

- Do NOT implement a global popstate hijack unless user explicitly asks later.
- Do NOT mirror forward delays symmetrically if it makes back feel slow — back should feel **equal or slightly faster**.
- Do NOT leave ease-in on reverse rail.

## Verification

- **Mechanical**: typecheck; grep `href="/"` / `href='/'` under `app/(main)/family` for Links missing `transitionTypes`.
- **Feel check** @ 10% and @ 100%:
  1. Open family via cover → click logo → catalogue. Order: detail fades, chrome grows, search returns, rail slides in as canvas shrinks.
  2. No worse than forward; ideally cleaner.
  3. Error-state “Back to Shelf” also animates.
  4. Browser back: no crash; best-effort morph OK.
- **Done when**: reverse is a readable staged sequence, not a harder jump than forward.
