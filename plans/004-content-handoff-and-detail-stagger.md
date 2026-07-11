# 004 — Body handoff + status strip + detail content stagger

- **Status**: DONE
- **Commit**: ca4b9a1
- **Severity**: MEDIUM
- **Category**: Missed opportunities / Cohesion (stagger)
- **Estimated scope**: 5–7 files (`view-transitions.css`, `sharedTransition.tsx` or new settle helper, `AppShell.tsx` footer, `AppStatusStrip.tsx` / stats wrappers, `FamilyDetailContent.tsx`, small settle component)

## Problem

1. Body is a single `content-fade` on the whole page bucket (`PageVt` in `AppShell.tsx:59-63`). No staged handoff relative to chrome/rail beyond a short delay.
2. Bottom status metrics hard-swap: `ShelfStats` ↔ `FamilyStatusStats` with **no** ViewTransition and no stagger (`AppShell.tsx:68-73`, `AppStatusStrip.tsx`, stats components).
3. `FamilyDetailContent` mounts all sections at once with no entrance stagger (`FamilyDetailContent.tsx:26-54`).
4. Stale comments claim `RoutePageVt settle-3d` (`FamilyDetailSampleMorph.tsx:7`, `FamilyHeader.tsx:9`) — that path is gone; body is only `content-fade`.

User ask: bottom status items should animate; detail content should stagger; sequence should feel filmed.

## Target

### PHASE 3 — Body handoff (VT)

Tighten content-fade to plan 001 timings; add a slight directional bias on forward/back **without** large slides (large slides on full body fight the shell continuity):

```css
::view-transition-old(.content-fade) {
  animation: var(--vt-duration-exit) var(--vt-ease-out) both vt-fade reverse;
}

::view-transition-new(.content-fade) {
  animation: var(--vt-duration-enter) var(--vt-ease-out) var(--vt-duration-enter-delay) both vt-fade;
}
```

Optional micro-slide (max 8px) only if fade alone feels flat:

```css
@keyframes vt-fade-rise {
  from { opacity: 0; filter: blur(1.5px); transform: translateY(8px); }
  to   { opacity: 1; filter: blur(0); transform: translateY(0); }
}
```

Use `vt-fade-rise` for **new** content on forward; reverse for back via separate classes if needed in plan 005. Keep blur ≤ 2px (AUDIT performance).

### PHASE 4 — Status strip

Wrap footer metrics (not theme/profile) in enter/exit VT **or** a mount stagger.

**Preferred:** keep ThemeSwitcher/ProfileMenu stable; only animate `data-status-metrics` children.

```tsx
// AppStatusStrip.tsx — conceptual
<section aria-label="App status" className="...">
  <StatusMetricsVt>
    <div data-status-metrics className="...">{children}</div>
  </StatusMetricsVt>
  <div className="ml-auto ...">
    <ThemeSwitcher />
    <ProfileMenu />
  </div>
</section>
```

```tsx
// StatusMetricsVt enter/exit → class "status-fade"
```

```css
::view-transition-old(.status-fade) {
  animation: 120ms var(--vt-ease-out) both vt-fade reverse;
}
::view-transition-new(.status-fade) {
  animation: 160ms var(--vt-ease-out) 80ms both vt-fade;
}
```

**Plus** CSS stagger on metric items after navigation (works even if VT is brief):

```tsx
// In ShelfStats / FamilyStatusStats map:
{items.map(([label, value], i) => (
  <div
    key={label}
    className="status-metric-enter flex items-baseline gap-1"
    style={{ animationDelay: `${i * 40}ms` }}
  >
```

```css
.status-metric-enter {
  animation: status-metric-in 160ms cubic-bezier(0.23, 1, 0.32, 1) both;
}
@keyframes status-metric-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .status-metric-enter { animation: status-metric-in 120ms ease both; }
  /* drop translate in reduced motion: */
  .status-metric-enter { animation-name: vt-fade; } /* opacity only */
}
```

Stagger **must not** block interaction (pointer-events stay auto; animation is decorative).

### PHASE 4 — Detail sections

Interface Craft stage-driven settle **after** route content mounts (not inside the VT snapshot if it fights VT). Use a tiny client component:

```tsx
// components/font/FamilyDetailSettle.tsx (new)
'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { TIMING } from '@/lib/motion/catalogDetailStoryboard';

const STAGES = {
  header: 0,
  specimen: 1,
  playground: 2,
  secondary: 3,
} as const;

export function FamilyDetailSettle({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const timers = [
      setTimeout(() => setStage(1), TIMING.settleStartMs),
      setTimeout(() => setStage(2), TIMING.settleStartMs + TIMING.staggerMs * 2),
      setTimeout(() => setStage(3), TIMING.settleStartMs + TIMING.staggerMs * 4),
      setTimeout(() => setStage(4), TIMING.settleStartMs + TIMING.staggerMs * 6),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);
  // provide stage via data attribute on wrapper for CSS
  return (
    <div data-detail-settle={stage} className="h-full min-h-0 w-full">
      {children}
    </div>
  );
}
```

Simpler **CSS-only** approach (prefer if line budget is tight):

```tsx
// FamilyDetailContent.tsx
<div className="h-full ... detail-settle">
  <div className="detail-settle-item" style={{ '--i': 0 }}><FamilyHeader /></div>
  <div className="detail-settle-item" style={{ '--i': 1 }}>...</div>
  ...
</div>
```

```css
.detail-settle-item {
  animation: detail-settle-in 200ms cubic-bezier(0.23, 1, 0.32, 1) both;
  animation-delay: calc(180ms + var(--i, 0) * 40ms);
}
@keyframes detail-settle-in {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .detail-settle-item {
    animation: vt-fade 120ms ease both;
    animation-delay: calc(var(--i, 0) * 20ms);
  }
}
```

Section order (stagger index):

0. `FamilyHeader`  
1. Specimen / `TypePlayground`  
2. `UseFontPanel`  
3. `FamilyInsights`  
4. Styles / charset / footer  

Cap total stagger so the last item starts by ~180 + 4*40 = **340ms** after mount (acceptable for rare navigation; shell already finished).

### Cleanup

Delete or rewrite stale `RoutePageVt settle-3d` comments in `FamilyHeader.tsx` and `FamilyDetailSampleMorph.tsx`.

## Repo conventions to follow

- TIMING from `catalogDetailStoryboard.ts` (plan 001).
- 100-line files: prefer CSS stagger utility in `styles/utilities-motion.css` or `view-transitions.css` over a heavy JS stage machine if it blows the line budget.
- Exemplar stagger in-repo: `styles/utilities-splash.css` wave stagger.
- Do not use Framer Motion list stagger for this unless already a dependency on the page for other reasons (VT + CSS is enough).

## Steps

1. Align `content-fade` durations/delays with plan 001 tokens.
2. Add status metric enter animation (CSS stagger on items in `ShelfStats` + `FamilyStatusStats`). Optionally wrap metrics in `StatusMetricsVt`.
3. Add `.detail-settle-item` (or `FamilyDetailSettle`) around sections in `FamilyDetailContent.tsx`.
4. Fix stale comments.
5. Reduced-motion: opacity only for settle/status (no translate).

## Boundaries

- Do NOT delay data fetching or block paint on timers for critical text — content must be in DOM immediately; animation is visual only (`both` fill from opacity 0 is OK for ~200ms on rare nav).
- Do NOT stagger every list row inside styles tables (only top-level sections).
- Do NOT animate theme switcher or profile menu.
- Do NOT add new animation libraries.

## Verification

- **Mechanical**: `npm run lint:lines`; `npm run typecheck`; composition tests if they snapshot class names.
- **Feel check**:
  1. Open a family: after shell motion, title appears first, then specimen/playground, then lower panels (40ms steps).
  2. Status strip metrics cascade in; theme/profile stay put.
  3. Reduced motion: fades only, no vertical travel.
  4. Spamming navigation: timers cleaned up (no stuck opacity 0) — remount resets settle.
- **Done when**: detail open feels like a handoff + settle, not one flat pop of the whole page after a shell jump.
