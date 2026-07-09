# Final Integration Fix Report

Date: 2026-07-10  
Branch: `codex/seriph-patterns-and-regressions`  
Starting HEAD: `f70eaf1`

## Scope Completed

1. Reload now cancels an active pagination request, and pagination refuses to start from a cached page while reload is refreshing it. Request generations still reject stale responses, so a response cannot overwrite the reloaded snapshot or advance past an unmerged cursor.
2. Pending local font files now carry their initiating UID. Consumption always clears the handoff and only returns files to the same UID; all producers and the deferred workspace pass the authenticated UID.
3. Retryable family-detail load failures retain a visible cached/preview family and carry a non-destructive background error. A definitive 404 still supersedes stale preview data.
4. Account-scoped negative family-detail entries now expire after 30 seconds, are capped at 64 entries, and are invalidated on library refresh/mutation/upload completion and sign-out. Immediate prefetch-to-navigation reuse remains deduplicated.
5. Shelf card motion no longer depends on total list size or swaps element types. The cached 48-card render is static, appended cards animate at 96 cards, stable keyed cards remain mounted, and reduced motion disables the effect.
6. The import route uses one stable 300px frame for idle and dynamic-chunk loading states, including pending-file auto-open.
7. The root `react-hooks/immutability` errors were resolved by using correctly named ref arguments and preserving ref ownership; no disable or suppression was added.
8. The direct 404 client suite is included in focused and full verification, including immediate 404 settlement, retryable error distinction, TTL expiry, and mutation invalidation.

## RED Evidence

Command:

```bash
rtk npm test -- tests/infiniteFamiliesLoadMore.test.ts tests/pendingFonts.test.ts tests/familyDetailRouteState.test.ts tests/familyDetailClientMissing.test.ts tests/familyDetailInvalidationBoundary.test.ts tests/shelfGridMotion.test.ts tests/importRouteBoundary.test.ts
```

Result before implementation: 7 files failed; 10 tests failed and 13 passed. Failures covered cross-account file consumption, preview replacement on 503, permanent 404 poisoning, missing mutation/auth invalidation, no 96-card append motion, keyed wrapper type changes, a blank dynamic import loading interval, and reload-time pagination. The first concurrency fixture left its intentionally deferred request unresolved and timed out; after making the fixture settle, `rtk npm test -- tests/infiniteFamiliesLoadMore.test.ts` failed on the intended assertion because pagination fetched `after-48` while `isRefreshing` was true.

Baseline lint command:

```bash
rtk npm run lint
```

Result before implementation: failed with four `react-hooks/immutability` errors in `lib/hooks/useInfiniteFamiliesLoadMore.ts` for mutating hook arguments named `inFlightMore` and `moreRequestId`.

Direct omitted-coverage command:

```bash
rtk npm test -- tests/familyDetailClientMissing.test.ts
```

Baseline result: 1 file and 4 tests passed, confirming the direct 404 test existed but had been omitted from the prior test-wave command. It was expanded in this patch.

## GREEN Evidence

Focused RED-to-GREEN command:

```bash
rtk npm test -- tests/infiniteFamiliesLoadMore.test.ts tests/pendingFonts.test.ts tests/familyDetailRouteState.test.ts tests/familyDetailClientMissing.test.ts tests/familyDetailInvalidationBoundary.test.ts tests/shelfGridMotion.test.ts tests/importRouteBoundary.test.ts
```

Result: 7 files and 23 tests passed.

Final broadened affected-module command:

```bash
rtk npm test -- tests/shelfPageCache.test.ts tests/infiniteFamiliesLoadMore.test.ts tests/infiniteFamiliesConcurrency.test.ts tests/pendingFonts.test.ts tests/familyDetailClient.test.ts tests/familyDetailClientMissing.test.ts tests/familyDetailPrefetchQueue.test.ts tests/familyDetailRouteState.test.ts tests/familyDetailInvalidationBoundary.test.ts tests/useFamilyRoutePrefetch.test.ts tests/shelfGridMotion.test.ts tests/importRouteBoundary.test.ts
```

Result: 12 files and 34 tests passed.

Quality gates:

| Command | Result |
| --- | --- |
| `rtk npm run lint:lines` | PASS |
| `rtk npm run typecheck` | PASS |
| `rtk npm run lint:web` | PASS |
| `rtk npm run lint` | PASS after provisioning the existing `functions/package-lock.json` with `rtk npm ci --prefix functions`; no manifest changed |
| `rtk npm test` | PASS, 50 files and 138 tests |
| `rtk npm test --prefix functions` | PASS, 28 files and 85 tests |
| `rtk npm run build --prefix functions` | PASS |
| `source /Users/adi/projects/seriph/.env.local` then `rtk npm run build` | PASS, production build and all 24 static pages generated |
| `rtk git diff --check` | PASS |

## Changed Files

Pagination and concurrency:

- `lib/hooks/useInfiniteFamilies.ts`
- `lib/hooks/useInfiniteFamiliesLoadMore.ts`
- `lib/hooks/useInfiniteFamiliesReload.ts`
- `tests/infiniteFamiliesLoadMore.test.ts`
- `tests/infiniteFamiliesConcurrency.test.ts`

Account-safe import handoff and loading frame:

- `utils/pendingFonts.ts`
- `components/home/HomePageContent.tsx`
- `app/(main)/family/[familyId]/page.tsx`
- `components/import/ImportWorkspace.tsx`
- `components/import/ImportWorkspaceFrame.tsx`
- `app/(main)/import/page.tsx`
- `tests/pendingFonts.test.ts`
- `tests/importRouteBoundary.test.ts`

Family detail outcomes and cache lifetime:

- `lib/cache/familyDetailClient.ts`
- `lib/cache/familyDetailNegativeCache.ts`
- `lib/cache/familyDetailPersistence.ts`
- `lib/hooks/familyDetailRouteState.ts`
- `lib/contexts/AuthContext.tsx`
- `tests/familyDetailClientMissing.test.ts`
- `tests/familyDetailRouteState.test.ts`
- `tests/familyDetailInvalidationBoundary.test.ts`

Shelf append motion:

- `components/home/ShelfFamilyGrid.tsx`
- `styles/utilities-motion.css`
- `tests/shelfGridMotion.test.ts`
- `tests/helpers/shelfGridMotionFixtures.ts`

Documentation:

- `.superpowers/sdd/final-fix-report.md`

No Functions source, package manifest, or lockfile changed.

## Concerns

- No live authenticated browser pass was rerun in this worker; the import loading interval is covered by rendered server markup, and motion is covered at realistic 48-to-96 card sizes.
- Root Vitest remains green but emits the existing non-failing warning that `--localstorage-file` has no valid path.
- Provisioning existing Functions dependencies reported Node `25.9.0` while the package requests Node 22 and reported 28 audit findings. Functions lint, tests, and build nevertheless pass; no dependency versions were changed here.
