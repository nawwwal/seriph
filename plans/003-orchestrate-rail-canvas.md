# 003 — Orchestrate rail yield + canvas expand

- **Status**: DONE
- **Commit**: ca4b9a1
- **Severity**: HIGH
- **Category**: Easing & duration / Performance / Cohesion
- **Estimated scope**: 2–3 files (`view-transitions.css`, `sharedTransition.tsx`, storyboard comment)

## Problem

User report: side rail collapse and main area growth are not smooth; curves feel wrong.

Current rail exit (`styles/view-transitions.css:77-85`):

```css
::view-transition-old(.rail-collapse) {
  animation: var(--vt-duration-exit) var(--vt-ease-in) both vt-rail-x reverse;
  z-index: 5;
}

::view-transition-new(.rail-expand) {
  animation: var(--vt-duration-enter) var(--vt-ease-out) both vt-rail-x;
  z-index: 5;
}
```

```css
@keyframes vt-rail-x {
  from { opacity: 0; transform: translateX(-28%); }
  to { opacity: 1; transform: translateX(0); }
}
```

Issues:

1. **`ease-in` on rail exit** — blocked by animation standards (starts slow, feels sticky).
2. **No delay** — rail and canvas fight header at 0ms; not staged (storyboard PHASE 2 should start ~40ms).
3. **Canvas morph** (`seriph-canvas` share) runs full move duration with weak ease-in-out; not locked to rail.
4. **28% translate** is large; combined with opacity can feel floaty / “using curves” in a soft, mushy way.
5. Live layout: sidebar is `{sidebar ? <RailVt>…` : null}` (`AppShell.tsx:42-52`). Space collapses when unmounted; only the VT snapshot slides. Canvas **must** morph width or the main column hard-jumps.

## Target

### Timing (from plan 001)

| Track | Delay | Duration | Easing |
| --- | --- | --- | --- |
| Rail exit (forward) | 40ms | 200ms | `--vt-ease-drawer` `cubic-bezier(0.32, 0.72, 0, 1)` |
| Canvas morph | 40ms | 220ms | `--vt-ease-in-out` `cubic-bezier(0.77, 0, 0.175, 1)` |
| Rail enter (back) | 0ms | 200ms | `--vt-ease-out` `cubic-bezier(0.23, 1, 0.32, 1)` |
| Canvas shrink (back) | 0ms | 220ms | same ease-in-out |

### CSS

```css
@keyframes vt-rail-x {
  from { opacity: 0; transform: translateX(-16%); }
  to { opacity: 1; transform: translateX(0); }
}

::view-transition-old(.rail-collapse) {
  animation: var(--vt-duration-exit) var(--vt-ease-drawer) var(--vt-duration-rail-delay) both vt-rail-x reverse;
  z-index: 5;
}

::view-transition-new(.rail-expand) {
  animation: var(--vt-duration-enter) var(--vt-ease-out) both vt-rail-x;
  z-index: 5;
}

::view-transition-group(seriph-canvas) {
  z-index: 10;
  animation-duration: var(--vt-duration-move);
  animation-delay: var(--vt-duration-rail-delay);
  animation-timing-function: var(--vt-ease-in-out);
  animation-fill-mode: both;
}

::view-transition-image-pair(seriph-canvas) {
  animation-name: vt-via-blur;
  animation-duration: var(--vt-duration-move);
  animation-delay: var(--vt-duration-rail-delay);
  animation-fill-mode: both;
}
```

Notes:

- Keep animating **transform + opacity only** on rail snapshots (already true).
- Canvas width/position is the UA group animation (allowed for VT groups; do not also transition live `width` on `[data-catalog-canvas]`).
- Reduce translate from `-28%` → `-16%` so the rail **yields** without a long travel that fights the canvas edge.

### React

`RailVt` / `CanvasVt` maps in `sharedTransition.tsx` are already correct:

```tsx
const railEnter = { [TRANSITION_TYPES.back]: 'rail-expand', default: 'none' };
const railExit = { [TRANSITION_TYPES.forward]: 'rail-collapse', default: 'none' };
// CanvasVt: name={VT.canvas} share="morph"
```

Ensure `open-family` also triggers rail exit (forward links pass both types). Today:

```tsx
// familyCoverLinkProps.ts
transitionTypes: [TRANSITION_TYPES.forward, TRANSITION_TYPES.openFamily],
```

`railExit` only keys `forward`. **Add `openFamily`:**

```tsx
const railExit = {
  [TRANSITION_TYPES.forward]: 'rail-collapse',
  [TRANSITION_TYPES.openFamily]: 'rail-collapse',
  default: 'none',
} as const;
```

(If Next merges types and `forward` is always present, still add `openFamily` for safety when only that type is passed.)

## Repo conventions to follow

- Duration/delay tokens only in `:root` + `TIMING` (plan 001).
- Class names `rail-collapse` / `rail-expand` stay stable.
- Exemplar: content-fade delay pattern already uses `animation-delay` on enter (`view-transitions.css:73-75`).

## Steps

1. Depend on plan 001 (`--vt-duration-rail-delay`, `--vt-ease-drawer`, no ease-in).
2. Update `vt-rail-x` translate to `-16%`.
3. Replace rail-collapse timing function with `--vt-ease-drawer` and delay `--vt-duration-rail-delay`.
4. Add matching delay + fill-mode on `::view-transition-group(seriph-canvas)` and its image-pair blur.
5. Extend `railExit` (and any content maps if needed) to include `openFamily`.
6. Confirm `CanvasVt` still wraps the flex-1 column in `AppShell.tsx` (do not wrap the row that also contains the rail — morph the canvas only).

## Boundaries

- Do NOT remove the alphabet rail component or change filter behavior.
- Do NOT animate live `width`/`flex-basis` on the aside or canvas with CSS transitions.
- Do NOT use `transition: all`.
- Do NOT change mobile layout rules (`md:flex-row`, horizontal rail) beyond VT classes.

## Verification

- **Mechanical**: `npm run lint:lines`; `rg "ease-in|vt-ease-in" styles/view-transitions.css` → no UI ease-in.
- **Feel check** @ 10% speed, desktop width ≥ `md`:
  1. Click family: rail begins ~40ms after chrome, slides left while fading; canvas width grows on the **same beat**, no empty gap flash, no hard jump to full width.
  2. Motion feels snappy at the start (drawer/out curves), not sticky.
  3. Reverse (logo home): rail expands from left as canvas shrinks together (plan 005 will polish order).
- **Done when**: canvas width change is continuous; rail never uses ease-in; open-family path collapses rail.
