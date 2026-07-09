# Seriph Cover Patterns and Regression Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every shelf and search font card feel like a distinctive, deterministic Seriph object while repairing the catalog, search, detail, and route-performance regressions found in the in-app-browser audit.

**Architecture:** Keep `FamilyCover` as the single card shell across shelf and search. Evolve its existing cover-DNA SVG grammar into a small library of seeded, flat duotone motifs. Repair the cache-first hooks so cached content remains visible, pages continue loading, and definitive missing details resolve quickly. Reduce avoidable client work without changing the product flow.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind 4, Framer Motion, Vitest, Firebase/Firestore client hooks.

## Global Constraints

- Preserve Seriph's existing editorial layout, density, border system, `seriph-card-hover`, and two-color theme-token palette.
- `FamilyCover` remains the shared catalog/search card. Do not make a second search-card visual system.
- Cover art is deterministic from `family.normalizedName` (falling back to `family.name`) plus the existing numeric `coverSeed`; it must never use time, `Math.random`, or account-specific data.
- The cover grammar includes at least six compositional motif families: folded facets, concentric portals, ribbon curves, stepped bands, radial bursts, and modular dots/bars. It may use flat `currentColor` opacity over the existing paper field, but no gradients, images, SVG filters, masks, or third color.
- Cover patterns keep a calm specimen-safe area and must not reduce the legibility of the foreground font preview.
- The large cover sample on catalog/search cards is exactly `ABC`; detail tester controls and unrelated type specimens remain unchanged.
- A regenerated cover seed produces a different deterministic motif/arrangement for the same family; the same normalized name and seed produce identical output.
- No populated shelf, search, or detail view may regress to a body loader or an empty grid during background refresh.
- Keep stable route/card keys, scroll anchoring, reduced-motion support, account-scoped cache behavior, and existing auth boundaries.
- Do not add feature flags, rollback endpoints, or alternate fallback paths. Fix the primary behavior cleanly.
- Respect the repository's 100 non-empty-line source-file limit. Split by responsibility rather than compressing code.
- Every task follows red-green-refactor, runs focused tests, and commits only its scoped files.

---

### Task 1: Seeded Duotone Cover Grammar and `ABC` Sample

**Files:**
- Modify: `lib/covers/coverDna.ts`
- Modify: `lib/covers/coverPatternRender.ts`
- Modify: `components/font/FamilyCoverArt.tsx`
- Test: `tests/coverDna.test.ts`

**Interfaces:**
- Consumes: `ShelfFamily`, `coverSeed`, and current `GeneratedCoverArt`/`getSampleChars` usage.
- Produces: a deterministic `CoverDna` whose `pattern` is one of the new motif families and SVG parts rendered only with `currentColor`/opacity.

- [ ] **Step 1: Write failing cover-DNA tests**

Add tests that assert all of the following:

```ts
expect(getSampleChars('Sans Serif')).toBe('ABC');
expect(deriveCoverDna(family({ normalizedName: 'abc-ginto-nord' }), 0))
  .toEqual(deriveCoverDna(family({ normalizedName: 'abc-ginto-nord' }), 0));
expect(deriveCoverDna(family({ normalizedName: 'abc-ginto-nord' }), 1).seed)
  .not.toBe(deriveCoverDna(family({ normalizedName: 'abc-ginto-nord' }), 0).seed);
expect(new Set(sampleNames.map((name) => deriveCoverDna(family({ name, normalizedName: name.toLowerCase() }), 0).pattern)).size)
  .toBeGreaterThanOrEqual(6);
expect(renderCoverSvgParts(dna).join('')).not.toMatch(/linearGradient|radialGradient|filter=|mask=|<image/);
```

- [ ] **Step 2: Run the focused test and verify it fails for the missing grammar/sample contract**

Run: `rtk npm test -- tests/coverDna.test.ts`

Expected: FAIL because the old samples are `Aa`/`Rg` and the old eight editorial patterns do not satisfy the new motif contract.

- [ ] **Step 3: Implement the minimal seeded cover grammar**

Change the hash input to `normalizedName || name` and `coverSeed` only. Replace the old stripe/grid-oriented union with a clear named union containing the six required motif families, using existing scalar DNA fields or small, typed extensions for count/phase. Render the motifs with pure SVG primitives and `currentColor`; keep the left/lower specimen area materially quieter than the right/background composition. Return `ABC` from `getSampleChars` for every family classification.

- [ ] **Step 4: Run focused tests and source-line lint**

Run: `rtk npm test -- tests/coverDna.test.ts && rtk npm run lint:lines`

Expected: PASS with no source-line violations.

- [ ] **Step 5: Commit the scoped change**

Run: `rtk git add lib/covers/coverDna.ts lib/covers/coverPatternRender.ts components/font/FamilyCoverArt.tsx tests/coverDna.test.ts && rtk git commit -m "feat: add seeded duotone cover motifs"`

### Task 2: Cached Shelf Pagination Continuation

**Files:**
- Modify: `lib/hooks/useInfiniteFamilies.ts`
- Modify: `lib/hooks/useInfiniteFamiliesLoadMore.ts`
- Modify: `lib/hooks/useInfiniteFamiliesReload.ts`
- Modify: `lib/shelf/familyPageCache.ts`
- Modify: `lib/shelf/persistentShelfCache.ts` only if the continuation bug is in snapshot parsing/storage
- Test: `tests/shelfPageCache.test.ts`
- Create if needed: `tests/infiniteFamiliesLoadMore.test.ts`

**Interfaces:**
- Consumes: `FamilyPageCache` with `{ families, nextCursor, hasMore, stats }` and the existing shelf sentinel/load-more path.
- Produces: a shelf that continues from a partial cached first page, appends pages by stable ID, and only reports an end when the server says `hasMore === false`.

- [ ] **Step 1: Write failing continuation tests**

Add a cache/helper or hook-level test representing a 232-family library where the persisted first page has 48 families and `hasMore: true`. Assert the next request uses the cached `nextCursor`, appends the following page without duplicates, preserves the full-library stats, and leaves `hasMore` true until the final page explicitly returns false.

- [ ] **Step 2: Run the focused shelf test and verify it fails**

Run: `rtk npm test -- tests/shelfPageCache.test.ts tests/infiniteFamiliesLoadMore.test.ts`

Expected: FAIL on the partial-cache continuation case before the implementation changes.

- [ ] **Step 3: Implement continuation without clearing cached content**

Repair the cursor/`hasMore` ownership so a partial persistent snapshot cannot be treated as a complete shelf. Keep the visible cached cards mounted, use the latest cached cursor for prefetch/load-more, guard concurrent requests, and preserve the existing scroll/anchor behavior.

- [ ] **Step 4: Run focused tests and source-line lint**

Run: `rtk npm test -- tests/shelfPageCache.test.ts tests/infiniteFamiliesLoadMore.test.ts && rtk npm run lint:lines`

Expected: PASS.

- [ ] **Step 5: Commit the scoped change**

Run: `rtk git add lib/hooks/useInfiniteFamilies.ts lib/hooks/useInfiniteFamiliesLoadMore.ts lib/hooks/useInfiniteFamiliesReload.ts lib/shelf/familyPageCache.ts lib/shelf/persistentShelfCache.ts tests/shelfPageCache.test.ts tests/infiniteFamiliesLoadMore.test.ts && rtk git commit -m "fix: continue catalog pagination from cached pages"`

### Task 3: Search Refinement Retention and Suggestion Clarity

**Files:**
- Modify: `lib/hooks/useFontSearch.ts`
- Modify: `lib/hooks/useSemanticFontSearch.ts`
- Modify: `components/search/SearchWorkspace.tsx`
- Modify: `lib/search/searchView.ts` only if view state needs a typed discriminant
- Test: `tests/searchLocal.test.ts`
- Create if needed: `tests/searchRefinementState.test.ts`

**Interfaces:**
- Consumes: local prepared-index results, URL filters, semantic response/cache state.
- Produces: `{ results, isRefining, resultPresentation }` behavior in which local filtered candidates remain visible through remote refinement and a fallback listing is explicitly marked as suggestions.

- [ ] **Step 1: Write failing search-state tests**

Test that applying `variable` to a populated local result set returns the filtered local candidates immediately while semantic refinement is pending, never an empty result array caused only by `isRefining`. Test a no-direct-match fallback exposes a typed suggestion presentation rather than looking like an exact `N results` match.

- [ ] **Step 2: Run focused search tests and verify they fail**

Run: `rtk npm test -- tests/searchLocal.test.ts tests/searchRefinementState.test.ts`

Expected: FAIL because the current refinement state clears the grid and the fallback has no distinct presentation.

- [ ] **Step 3: Implement stable local-first presentation**

Compute and retain local filtered results synchronously for the current query/filter tuple. Keep them mounted while the semantic result is pending, replace/rerank only when the response still matches the active tuple, and render a concise suggestion label only for the fallback listing. Preserve stable `slug || id` card keys and existing cancellation/deduplication.

- [ ] **Step 4: Run focused tests and source-line lint**

Run: `rtk npm test -- tests/searchLocal.test.ts tests/searchRefinementState.test.ts && rtk npm run lint:lines`

Expected: PASS.

- [ ] **Step 5: Commit the scoped change**

Run: `rtk git add lib/hooks/useFontSearch.ts lib/hooks/useSemanticFontSearch.ts components/search/SearchWorkspace.tsx lib/search/searchView.ts tests/searchLocal.test.ts tests/searchRefinementState.test.ts && rtk git commit -m "fix: retain local search results while refining"`

### Task 4: Fast Missing-Detail Resolution and Intent Dedupe

**Files:**
- Modify: `app/(main)/family/[familyId]/page.tsx`
- Modify: `lib/cache/familyDetailClient.ts`
- Modify: `lib/cache/familyDetailPrefetchQueue.ts` only if required for intended-ID dedupe
- Modify: the existing family detail hook/module discovered by the route
- Test: `tests/familyDetailClient.test.ts`
- Create if needed: `tests/familyDetailRouteState.test.ts`

**Interfaces:**
- Consumes: route family ID, account-scoped cache aliases, `loadFamilyDetail`, and the stable detail chrome/error frame.
- Produces: typed `not-found`/`load-error` outcomes and a route body that exits the loader promptly for a definitive missing family without losing app chrome.

- [ ] **Step 1: Write failing detail-state tests**

Add tests for a 404 family fetch that resolves to a typed missing-detail outcome without a retry delay, alias/canonical cache behavior, and concurrent same-ID intent prefetch dedupe. The test must verify that an unrelated family ID is never substituted for the requested card's ID.

- [ ] **Step 2: Run focused detail tests and verify they fail**

Run: `rtk npm test -- tests/familyDetailClient.test.ts tests/familyDetailPrefetchQueue.test.ts tests/familyDetailRouteState.test.ts`

Expected: FAIL because the current client route cannot represent the definitive missing state promptly.

- [ ] **Step 3: Implement decisive detail outcomes**

Map HTTP 404 to a typed missing result, keep other errors distinct, and make the route render its existing stable error/not-found frame immediately after that result. Preserve preview-first cached rendering, canonical alias caching, bounded prefetch concurrency, and the real `NavBar`. Do not add timeouts or a second fetch fallback for a confirmed 404.

- [ ] **Step 4: Run focused tests and source-line lint**

Run: `rtk npm test -- tests/familyDetailClient.test.ts tests/familyDetailPrefetchQueue.test.ts tests/familyDetailRouteState.test.ts && rtk npm run lint:lines`

Expected: PASS.

- [ ] **Step 5: Commit the scoped change**

Run: `rtk git add app/'(main)'/family/'[familyId]'/page.tsx lib/cache/familyDetailClient.ts lib/cache/familyDetailPrefetchQueue.ts tests/familyDetailClient.test.ts tests/familyDetailPrefetchQueue.test.ts tests/familyDetailRouteState.test.ts && rtk git commit -m "fix: resolve missing family details promptly"`

### Task 5: Initial-Route Client Work Reduction

**Files:**
- Modify: `components/home/ShelfFamilyGrid.tsx`
- Modify: `app/(main)/import/page.tsx`
- Create/modify: focused import workspace module only if needed to defer upload-only behavior
- Test: `tests/shelfGridMotion.test.ts`
- Test: `tests/importRouteBoundary.test.ts`

**Interfaces:**
- Consumes: stable cached shelf family list, `isRefreshing`, reduced-motion preference, authenticated import page state.
- Produces: no costly initial grid layout animation for an already-populated cache snapshot, seamless append/refresh behavior, and an import route shell that does not eagerly execute upload/parser-only work before interaction.

- [ ] **Step 1: Write failing route-work tests**

Add a shelf-grid test proving a populated first render does not assign entrance/layout animation to every cached card, while appended cards still have the existing unobtrusive motion behavior and reduced-motion remains static. Add an import boundary test proving the always-visible import frame does not statically import the upload/parser workspace.

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `rtk npm test -- tests/shelfGridMotion.test.ts tests/importRouteBoundary.test.ts`

Expected: FAIL because cached first renders use the same Framer Motion entry path as new cards and the import route eagerly imports upload behavior.

- [ ] **Step 3: Implement the smallest route-work reduction**

Keep the existing card hover interaction and use a low-key opacity/transform transition only for new/changed cards. Do not animate an already-cached initial grid. Split the import route into a light, instantly rendered authenticated frame and an interaction-bound upload workspace, keeping the visible screen stable while that workspace hydrates. Do not add a generic loader or defer auth/navigation chrome.

- [ ] **Step 4: Run focused tests and source-line lint**

Run: `rtk npm test -- tests/shelfGridMotion.test.ts tests/importRouteBoundary.test.ts && rtk npm run lint:lines`

Expected: PASS.

- [ ] **Step 5: Commit the scoped change**

Run: `rtk git add components/home/ShelfFamilyGrid.tsx app/'(main)'/import/page.tsx components/import tests/shelfGridMotion.test.ts tests/importRouteBoundary.test.ts && rtk git commit -m "perf: reduce initial shelf and import client work"`

## Implementation Wave Review Gates

After every task, generate a review package from the branch base `d5ef41fa3ccf7a24d5b8049c9f7730b9d059361b` to the task head, dispatch a fresh task reviewer, and fix all Critical or Important findings before continuing.

## Testing Wave

After Tasks 1-5 are reviewed cleanly, use separate test subagents for these disjoint checks:

1. Browser visual and interaction verification: `ABC` card sample, deterministic/regenerated covers, catalog/search visual parity, no text overlap, desktop/mobile coverage.
2. Browser regression verification: full 232-family pagination, non-blank variable filtering, immediate missing-detail error, shelf/detail/import timing comparison, console/network failures.
3. Code-quality verification: full quality gates and a whole-branch review package against `d5ef41f`.

## Acceptance Criteria

- Catalog and search cards show `ABC` in the live cover face and share the same cover shell.
- At least six visibly distinct, calm, two-tone seeded cover motif families appear across a representative shelf; regenerating covers changes them deterministically.
- Catalog scrolling reaches the complete 232-family test library rather than ending at 144 cards.
- Applying a filter never converts a populated search view into `0 results` merely because refinement is pending.
- A nonexistent detail route reaches a usable error/not-found frame in under one second after the definitive response, with no duplicate/wrong-ID detail request.
- Cached routes keep their static snapshot visible while refreshing; initial cached shelf cards do not all enter through a costly layout animation.
- The import route preserves its useful frame while upload/parser-only code stays out of its initial path.
- `rtk npm run lint:lines`, `rtk npm run typecheck`, `rtk npm run lint`, `rtk npm test`, and `rtk npm run build` pass before release.
