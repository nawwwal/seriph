# 002 — Fix header compress (stop whole-header shared morph)

- **Status**: DONE
- **Commit**: ca4b9a1
- **Severity**: HIGH
- **Category**: Physicality & origin / Performance / Cohesion
- **Estimated scope**: 4–5 files (`AppShellHeader.tsx`, `sharedTransition.tsx`, `view-transitions.css`, `catalogDetailStoryboard.ts`, maybe `HomeHeaderSearch` wrapper only if needed)

## Problem

User report: tall top chrome jumps to the compact bar; only the Seriph logo animates.

Root cause: the entire `<header>` is a **shared morph** (`share="morph"`, name `seriph-header`), but old and new headers are **unrelated UIs**:

| Catalogue | Detail |
| --- | --- |
| Logo + large search | Logo + “Add Style” / “Test in Text” |
| `h-20` / `sm:h-24` | `h-10` |

Shared element morph is for the **same visual** (thumbnail → hero). Morphing dissimilar bitmaps produces a stretch/crossfade that reads as a **hard cut**. The logo works because it is the only true shared mark.

Current code (`components/layout/AppShellHeader.tsx:19-39`):

```tsx
return (
  <SharedVt name={headerTransitionName()} share="morph">
    <header
      data-home-header
      className={`rule-b flex w-full shrink-0 items-center gap-3 px-4 sm:px-6 ${
        compact
          ? 'h-10 min-h-10'
          : 'h-20 min-h-20 gap-4 sm:h-24 sm:min-h-24 sm:gap-6'
      }`}
    >
      <AppShellLogoLink compact={compact} />
      {!compact ? (
        <div className="relative min-w-0 flex-1">
          <HomeHeaderSearch />
        </div>
      ) : null}
      {compact && headerActions ? (
        <div className="ml-auto flex min-w-0 items-center gap-2">{headerActions}</div>
      ) : null}
    </header>
  </SharedVt>
);
```

Logo is a nested shared morph (`components/brand/SeriphLogo.tsx:41-43`). Nested named elements without nested view-transition groups float as **sibling** groups, so logo motion detaches from header height.

## Target

### Motion vocabulary

- **Shared element transition**: logo only.
- **Layout animation**: header height via a named **chrome shell** (empty geometry), not content morph.
- **Enter / Exit**: search exits forward; actions enter forward (and reverse on back).
- **Orchestration**: PHASE 1 from plan 001.

### Structure

```tsx
// Target shape for AppShellHeader (conceptual)
<header data-home-header className={heightClasses}>
  {/* 1. Height shell: name=seriph-header, share=morph — ONLY the bar box.
      Prefer wrapping a full-width empty overlay OR the header element
      with view-transition that does NOT include swap of unrelated children
      as the morph identity. Best pattern below. */}
  <SharedVt name={VT.header} share="morph">
    <div data-header-shell className="pointer-events-none absolute inset-0" aria-hidden />
  </SharedVt>
  {/* OR: put name on <header> but default share with old/new content forced to
      crossfade without size-squash artifacts — see CSS targets. */}

  <AppShellLogoLink /> {/* logo keeps SharedVt name=seriph-logo share=morph */}

  {!compact ? (
    <HeaderSearchVt> {/* enter/exit only, NO name share */}
      <div className="relative min-w-0 flex-1"><HomeHeaderSearch /></div>
    </HeaderSearchVt>
  ) : null}

  {compact && headerActions ? (
    <HeaderActionsVt>
      <div className="ml-auto ...">{headerActions}</div>
    </HeaderActionsVt>
  ) : null}
</header>
```

**Preferred, simpler pattern that matches React/Next docs:**

1. **Remove** `SharedVt` / `name={seriph-header}` from wrapping the whole header content morph.
2. Keep **logo** as the only nested `share="morph"`.
3. Apply `view-transition-name: seriph-header` (via `SharedVt` or `ViewTransition name={VT.header}`) on the **`<header>` element** but force old/new snapshots to **not** participate in a content morph that stretches search into buttons:

```css
/* Header: animate GROUP size only; hide mismatched content crossfade */
::view-transition-group(seriph-header) {
  z-index: 40;
  animation-duration: var(--vt-duration-move);
  animation-timing-function: var(--vt-ease-in-out);
}

/* Prevent the "search smears into buttons" look */
::view-transition-old(seriph-header),
::view-transition-new(seriph-header) {
  /* Height/width come from the group; content should crossfade cleanly */
  animation: var(--vt-duration-exit) var(--vt-ease-out) both vt-fade reverse;
  /* new overrides below */
}

::view-transition-new(seriph-header) {
  animation: var(--vt-duration-enter) var(--vt-ease-out) var(--vt-duration-actions-delay) both vt-fade;
}

/* Optional: mid blur only if still harsh */
::view-transition-image-pair(seriph-header) {
  animation-name: vt-via-blur;
  animation-duration: var(--vt-duration-move);
}
```

4. **Also** wrap search and actions in enter/exit-only ViewTransitions so they can leave/arrive without being the morph subject:

```tsx
// sharedTransition.tsx — add
const searchExit = {
  [TRANSITION_TYPES.forward]: 'header-search-exit',
  [TRANSITION_TYPES.openFamily]: 'header-search-exit',
  [TRANSITION_TYPES.back]: 'header-search-enter', // reverse: search returns on back
  default: 'none',
} as const;

const searchEnter = {
  [TRANSITION_TYPES.back]: 'header-search-enter',
  default: 'none',
} as const;

const actionsEnter = {
  [TRANSITION_TYPES.forward]: 'header-actions-enter',
  [TRANSITION_TYPES.openFamily]: 'header-actions-enter',
  default: 'none',
} as const;

const actionsExit = {
  [TRANSITION_TYPES.back]: 'header-actions-exit',
  default: 'none',
} as const;
```

```css
/* Search leaves up + fade (forward) */
::view-transition-old(.header-search-exit) {
  animation: var(--vt-duration-exit) var(--vt-ease-out) both vt-header-slot-out;
}
::view-transition-new(.header-search-enter) {
  animation: var(--vt-duration-enter) var(--vt-ease-out) both vt-header-slot-in;
}

/* Actions arrive after search clears */
::view-transition-new(.header-actions-enter) {
  animation: var(--vt-duration-enter) var(--vt-ease-out) var(--vt-duration-actions-delay) both vt-header-slot-in;
}
::view-transition-old(.header-actions-exit) {
  animation: var(--vt-duration-exit) var(--vt-ease-out) both vt-header-slot-out;
}

@keyframes vt-header-slot-out {
  from { opacity: 1; transform: translateY(0); }
  to   { opacity: 0; transform: translateY(-6px); }
}
@keyframes vt-header-slot-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

**Do not use `scale(0)`.** Max translate 6–8px. Opacity always paired.

### Height classes stay

Keep `h-20/sm:h-24` ↔ `h-10` on the real header. The group morph (or at minimum the visible crossfade + delayed actions) must make height change **readable over ~220ms**, not a one-frame jump.

If after pairing, the group still jumps: set explicit height animation only via group duration (UA already animates width/height on `::view-transition-group`). Do **not** animate `height` on the live element with CSS transitions during VT (double-driving).

## Repo conventions to follow

- Wrappers live in `components/motion/sharedTransition.tsx` (`SharedVt`, `CanvasVt`, `RailVt`, `PageVt`).
- Names from `VT` in `lib/motion/catalogDetailStoryboard.ts`.
- Classes for enter/exit are plain strings matched by `::view-transition-old(.class)` in `styles/view-transitions.css`.
- 100-line file limit: split new wrappers into `components/motion/headerTransition.tsx` if `sharedTransition.tsx` would exceed 100 non-empty lines.
- Exemplar for enter/exit maps: existing `railEnter` / `contentEnter` in `sharedTransition.tsx:13-33`.

## Steps

1. Confirm plan 001 tokens exist (`--vt-duration-actions-delay`, strong easings).
2. In `AppShellHeader.tsx`, wrap search branch with a new `HeaderSearchVt` and actions branch with `HeaderActionsVt` (enter/exit maps above). Keep logo as-is.
3. Keep `SharedVt name={headerTransitionName()}` on the **outer header** for height continuity, but add CSS so old/new header **content** crossfades with exit/enter timings (Target CSS). Do not rely on default morph smear.
4. Add keyframes `vt-header-slot-out` / `vt-header-slot-in` and the four class rules in `view-transitions.css`.
5. Ensure logo z-index stays above header (`::view-transition-group(seriph-logo) { z-index: 50 }`, already present).
6. Update storyboard PHASE 1 lines if 001 left placeholders.
7. Respect `useReducedMotion`: new wrappers must `if (reduce) return children` like existing helpers.

## Boundaries

- Do NOT change FamilyHeaderActions labels, search behavior, or routing.
- Do NOT morph cover cards into the detail hero in this plan (out of scope).
- Do NOT animate layout props on live DOM (`height`/`width` transitions on `header` className).
- Do NOT reintroduce `--vt-ease-in`.
- If file line budget forces a split, keep public exports stable.

## Verification

- **Mechanical**:
  - `npm run lint:lines`
  - `npm run typecheck`
  - `npm test -- tests/homeShellComposition.test.ts` (update string assertions if they require old single-wrapper shape)
- **Feel check** (Animations panel @ 10% speed):
  1. From catalogue, click a family cover.
  2. Logo **scales** continuously (shared morph).
  3. Header **height** eases from tall → `h-10` over ~220ms (no one-frame snap).
  4. Search **fades/slides out**; actions **fade in after** (~80ms), not simultaneous hard swap.
  5. No frame where search field is stretched into button shapes.
- **Done when**: a slow-mo recording shows staged chrome compress; logo is not the only moving part.

## Residual risk

If React still pairs header old/new as a harsh morph, fall back to: remove `name` from header entirely; only logo shares; height change is implied by layout as search unmounts — then use a **single** full-width `::view-transition-group` on a dummy bar is wrong. Better fallback: `share="auto"` with short crossfade only. Document which path you shipped in the PR.
