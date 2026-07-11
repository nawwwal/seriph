# Home Shell, Logo, and Type Playground Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the approved Figma-derived catalog shell, theme-aware Seriph wordmark, and unified LTR family type playground without regressing the cache-first shelf or family-detail flow.

**Architecture:** The logo is one mask-based primitive shared by brand surfaces. The home controller keeps its existing data and mutation ownership while a new presentational shell composes header, responsive alphabet rail, catalog canvas, and compact status strip. The playground uses pure model/unit helpers plus focused controls and replaces both legacy tester surfaces.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind/CSS variables, Vitest, Playwright browser verification.

## Global Constraints

- Preserve all cache-first shelf, search, detail, upload, selection, mutation, prefetch, and scroll-restoration behavior.
- Use only existing theme tokens; the interface remains two-color.
- Keep every source file at or below 100 nonempty lines.
- Use stable family IDs as card keys and never replace populated content with a loader.
- Respect reduced motion and keyboard accessibility.
- Port relevant paused work from `/Users/adi/projects/seriph`; do not overwrite newer contracts in this worktree.
- Make small, independently understandable commits inside each task and push every reviewed commit to draft PR #9.

---

### Task 1: Theme-Aware Seriph Wordmark

**Files:**
- Create: `public/seriph-logo.svg`
- Create: `components/brand/SeriphLogo.tsx`
- Modify: `components/layout/NavBar.tsx`
- Modify: `components/home/LandingPage.tsx`
- Test: `tests/seriphLogo.test.ts`

**Interfaces:**
- Produces: `SeriphLogo({ className?, label? }: { className?: string; label?: string })`
- The component renders a stable `193 / 48` mask, inherits `currentColor`, and does not fetch or import SVG markup into the client bundle.

- [ ] **Step 1: Write the failing structural test**

Assert that the component references `/seriph-logo.svg`, exposes an accessible brand label, uses `currentColor`, and primary brand surfaces import it instead of rendering a text-only `Seriph` wordmark.

- [ ] **Step 2: Run the focused test and verify the expected failure**

Run: `npm test -- tests/seriphLogo.test.ts`

Expected: failure because `components/brand/SeriphLogo.tsx` does not exist.

- [ ] **Step 3: Normalize the asset and implement the primitive**

Copy the supplied geometry without fixed theme fills. Render a semantic span with CSS mask properties, `aspectRatio: '193 / 48'`, `backgroundColor: 'currentColor'`, and visually-hidden text when a label is supplied.

- [ ] **Step 4: Replace primary static text wordmarks**

Use the component in `NavBar` and `LandingPage`, preserving link destinations, auth behavior, action layout, and the loading splash animation.

- [ ] **Step 5: Verify and commit in two slices**

Run: `npm test -- tests/seriphLogo.test.ts && npm run typecheck && npm run lint:lines`

Commits:

- `feat: add themed Seriph wordmark primitive`
- `feat: adopt Seriph wordmark across brand surfaces`

---

### Task 2: Figma Home Shell and Alphabet Catalog

**Files:**
- Create: `components/home/HomeShell.tsx`
- Create: `components/home/AlphabetRail.tsx`
- Create: `components/home/alphabetFilter.ts`
- Modify: `components/home/HomePageContent.tsx`
- Modify: `components/home/HomePageShelfContent.tsx`
- Modify: `components/home/ShelfStats.tsx`
- Modify: `components/layout/AppFrame.tsx`
- Modify: `components/layout/NavBar.tsx`
- Modify: `styles/utilities.css`
- Test: `tests/homeAlphabetFilter.test.ts`
- Test: `tests/homeShellComposition.test.ts`

**Interfaces:**
- Consumes: `SeriphLogo` from Task 1.
- Produces: `filterFamiliesByInitial(families, initial)` where `initial` is `'ALL' | 'A' ... 'Z'`.
- Produces: `HomeShell` slots for header actions, alphabet rail, catalog canvas, and status strip.

- [ ] **Step 1: Write failing pure-filter tests**

Cover ALL, case-insensitive initial matching, non-letter family names, and preservation of input order and object identity.

- [ ] **Step 2: Write failing composition tests**

Assert the signed-in home no longer imports the hero `HomeHeader`/`HomeFooter`, includes the themed wordmark, alphabet rail, catalog canvas, compact status strip, and retains shelf upload/selection/mutation composition.

- [ ] **Step 3: Run tests and verify both fail for missing behavior**

Run: `npm test -- tests/homeAlphabetFilter.test.ts tests/homeShellComposition.test.ts`

- [ ] **Step 4: Implement filter and responsive shell**

Match the approved desktop proportions: 20px inset, bordered/radius shell, 96px header, 368px rail, flexible canvas, 40px status strip. At narrower widths, move alphabet controls above the catalog as a horizontal scroller and allow actions/status to wrap without overlap.

- [ ] **Step 5: Integrate existing shelf behavior**

Keep `useInfiniteFamilies`, upload completion invalidation, mutations, pending ingests, card keys, cover regeneration, scroll restoration, and empty/error handling in `HomePageContent`. Derive the visible family list from the selected initial without modifying cached data. Keep navigation/actions reachable in the shell without rendering a duplicate global bar.

- [ ] **Step 6: Verify and commit in three slices**

Run: `npm test -- tests/homeAlphabetFilter.test.ts tests/homeShellComposition.test.ts tests/appFrameComposition.test.ts tests/shelfSelection.test.ts tests/shelfScrollSnapshot.test.ts && npm run typecheck && npm run lint:lines`

Commits:

- `feat: add alphabet catalog filtering`
- `feat: add responsive catalog shell`
- `feat: integrate shelf into home shell`

---

### Task 3: Unified LTR Type Playground

**Files:**
- Create/port: `components/font/TypePlayground.tsx`
- Create/port: `components/font/TypePlaygroundControls.tsx`
- Create/port: `components/font/TypePlaygroundEditor.tsx`
- Create/port: `components/font/TypePlaygroundRange.tsx`
- Create/port: `components/font/TypePlaygroundStyleSelect.tsx`
- Create/port: `components/font/typePlaygroundModel.ts`
- Create/port: `components/font/typePlaygroundState.ts`
- Create/port: `components/font/typePlaygroundUnits.ts`
- Create/port: `components/ui/ElasticSlider.tsx`
- Create/port: `components/ui/ElasticSliderValue.tsx`
- Create/port: `components/ui/elasticSliderMath.ts`
- Modify: `components/font/AxisSlider.tsx`
- Modify: `components/font/FamilyDetailContent.tsx`
- Modify: `lib/hooks/useVariableFontFace.ts`
- Modify: `styles/utilities-slider.css`
- Modify: `app/globals.css`
- Delete: `components/font/TypeTester.tsx`
- Delete: `components/font/VariableFontPlayground.tsx`
- Delete: `components/font/VariableFontPlaygroundControls.tsx`
- Test: `tests/typePlaygroundModel.test.ts`
- Test: `tests/typePlaygroundComposition.test.ts`
- Test: `tests/elasticSliderMath.test.ts`

**Interfaces:**
- Produces one `TypePlayground({ family, testerRef })` replacing both legacy surfaces.
- State is keyed by font face ID and includes text, size, letter-spacing mode/value, line-height mode/value, and axis values.
- CSS serializer emits `font-family`, `font-size`, `letter-spacing`, `line-height`, and `font-variation-settings` only when relevant.

- [ ] **Step 1: Write failing model and slider tests**

Cover closest upright 400 selection, unique face IDs, 12–200 size clamp, px/em-relative spacing conversion, Auto/%/px line height, CSS serialization, reset defaults, Arrow/Shift/Home/End slider math, and axis default reset.

- [ ] **Step 2: Write failing composition tests**

Assert one playground appears between `Specimen` and `UseFontPanel`, legacy surfaces are absent, textarea direction is explicitly LTR, controls are conditional on selected-face axes, and actions are `Reset` and `Copy CSS`.

- [ ] **Step 3: Run focused tests and verify expected failures**

Run: `npm test -- tests/typePlaygroundModel.test.ts tests/typePlaygroundComposition.test.ts tests/elasticSliderMath.test.ts`

- [ ] **Step 4: Selectively port and harden the paused implementation**

Reuse the existing visual work where it matches the spec. Adapt it to current full/preview detail reconciliation. Key style selection by face ID, default to Regular/400, retain the explicit `dir="ltr"`, add line-height Auto, serialize Copy CSS, provide stable `Copied` feedback, and implement all required slider keyboard/ARIA behavior.

- [ ] **Step 5: Replace legacy family-detail composition**

Render the static specimen, unified playground, then `UseFontPanel`; preserve insights, styles, character set, footer, preview skeleton behavior, tester scroll targeting, and selected values during background detail refresh.

- [ ] **Step 6: Verify and commit in four slices**

Run: `npm test -- tests/typePlaygroundModel.test.ts tests/typePlaygroundComposition.test.ts tests/elasticSliderMath.test.ts tests/familyDetailPreview.test.ts tests/familyDetailClientRefresh.test.ts && npm run typecheck && npm run lint:lines`

Commits:

- `feat: add type playground state model`
- `feat: add accessible elastic slider`
- `feat: build unified type playground controls`
- `feat: integrate playground into family details`

---

### Task 4: Browser QA, InterfaceCraft Review, and Release Fixes

**Files:**
- Modify only files implicated by concrete findings.
- Add focused regression tests for every code-level bug found.
- Update: `docs/superpowers/plans/2026-07-11-home-shell-logo-type-playground.md` task checkboxes.

**Interfaces:**
- Consumes the complete Tasks 1–3 branch.
- Produces screenshots, timings, test evidence, and a production-verified draft PR.

- [ ] **Step 1: Run independent browser test agents**

Verify desktop and mobile home, warm/cold catalog, alphabet filter, cards, selection, uploads, search access, theme switching, fixed-family detail, variable-family detail, LTR typing, every metric mode, axes, Reset, Copy CSS, and reduced motion.

- [ ] **Step 2: Run independent InterfaceCraft critique agents**

Review screenshots for hierarchy, density, alignment, control ergonomics, transition quality, text overflow, and fidelity to Figma node `5:5`. Record only actionable findings.

- [ ] **Step 3: Fix findings test-first with one commit per finding cluster**

Add focused regressions, verify red, implement minimal fixes, and keep home-fidelity, playground-interaction, accessibility, and regression fixes in separate commits.

- [ ] **Step 4: Run full local gates**

Run: `npm run lint:lines && npm run typecheck && npm run lint && npm test && npm run build && npm run test --prefix functions && npm run build --prefix functions`

- [ ] **Step 5: Deploy and repeat critical browser flows**

Deploy the branch to Vercel, verify the public preview, then repeat home/catalog navigation and fixed/variable playground flows with console/network inspection.

- [ ] **Step 6: Update the draft PR**

Push all commits and update PR #9 with implementation summary, screenshots, exact verification commands, performance observations, and any residual risk.
