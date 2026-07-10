# Seriph Next Architecture and Detail Parity Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development task-by-task. Steps use checkbox syntax for tracking.

Goal: Restore one complete, cache-first AI-enriched detail experience from catalog
and search while removing the highest-value App Router composition and
initial-bundle problems.

Architecture: Keep account-owned data in the existing IndexedDB and memory
caches. Introduce one typed enrichment view model that the detail adapter,
detail UI, and search-preview path all use. Make cached detail render first and
issue a deduplicated live refresh in the background. Put persistent navigation
chrome in an AppFrame that composes route children, then defer the Upload Center
overlay until it is needed.

Tech Stack: Next.js 16.2 App Router, React 19.2, TypeScript 6, Firebase
Auth/Firestore, IndexedDB via idb, Vitest, React DOM server rendering.

## Global Constraints

- Preserve Firebase client authentication and account-scoped cache isolation.
- Do not cache private family payloads in Vercel Data Cache or enable
  cacheComponents in this release.
- Keep catalog/search/detail cache-first. A populated detail view must never be
  replaced by a route loader during refresh.
- Keep the existing visual language, dense information hierarchy, card
  contracts, scroll restoration, and reduced-motion behavior.
- Use discriminated outcomes and runtime boundary validation; do not add any or
  unvalidated casts.
- The 100 non-empty-line source-file limit remains enforced.
- The combined branch must include the prior cover/cache release before final
  merge and production verification.

---

## Task 1: Canonical Detail Enrichment Contract and Display

Files:
- Modify: models/font-family.models.ts
- Modify: lib/db/catalogAdapter.ts
- Create: components/font/FamilyInsights.tsx
- Modify: components/font/FamilyDetailContent.tsx
- Modify: docs/openapi/seriph-api.yaml
- Create: tests/catalogAdapter.test.ts
- Create: tests/familyInsights.test.tsx

Consumes: current Firestore FontEnrichment fields: classification, summary,
moods, voice, useCases, pairingHints, confidence, modelId, promptVersion,
embeddingModel, embeddingVersion, and enrichedAt.

Produces: a typed FamilyEnrichment field within FamilyMetadata and a detail UI
that consistently renders user-facing enrichment.

- [ ] Step 1: Write the failing adapter test.

~~~ts
it('maps every user-facing enrichment field from a catalog family', () => {
  const family = adaptFamilyDoc({
    name: 'Aeonik Pro', slug: 'aeonik-pro', category: 'SANS_SERIF', faces: [],
    enrichment: {
      summary: 'A precise neo-grotesk.', voice: 'calm and technical',
      classification: 'geometric sans', moods: ['clear'], useCases: ['product UI'],
      pairingHints: ['Pair with a literary serif'], confidence: 0.91,
      enrichedAt: '2026-07-10T00:00:00.000Z', modelId: 'gemini', promptVersion: 'v3',
    },
  }, 'aeonik-pro');

  expect(family.metadata.enrichment).toMatchObject({
    voice: 'calm and technical', pairingHints: ['Pair with a literary serif'], confidence: 0.91,
  });
  expect(family.description).toBe('A precise neo-grotesk.');
});
~~~

- [ ] Step 2: Run the focused test and verify RED.

Run: rtk npm test -- tests/catalogAdapter.test.ts
Expected: FAIL because FamilyMetadata has no typed enrichment object and the
adapter drops rich fields.

- [ ] Step 3: Add the type and validate/map the boundary.

Define FamilyEnrichment in models/font-family.models.ts with only user-facing,
serializable fields. In mapCatalogDoc, validate each field using existing text,
textArray, number, and ISO-date helpers. Preserve legacy metadata fields and
assign classification, summary, moods, voice, useCases, pairingHints, confidence,
and enrichedAt from data.enrichment. Do not expose internal model/prompt/
embedding IDs in the primary UI.

- [ ] Step 4: Add a compact FamilyInsights section.

Render only populated fields. It must include the summary, voice, mood and
use-case chips, pairing hints, classification, confidence, and analysis date.
Keep it a regular unframed section with rules and the existing type scale.
Place it in FamilyDetailContent before styles/tester, never in the preview
branch unless the preview contains actual enrichment.

- [ ] Step 5: Document the API payload.

Extend FontFamilyDetail.metadata in docs/openapi/seriph-api.yaml with a typed
enrichment object. Keep existing summary/moods/useCases fields backwards
compatible.

- [ ] Step 6: Run focused GREEN tests.

Run: rtk npm test -- tests/catalogAdapter.test.ts tests/familyInsights.test.tsx tests/openapi.test.ts
Expected: PASS and static markup contains populated AI insights but omits empty
rows.

- [ ] Step 7: Commit.

~~~bash
git add models/font-family.models.ts lib/db/catalogAdapter.ts components/font/FamilyInsights.tsx components/font/FamilyDetailContent.tsx docs/openapi/seriph-api.yaml tests/catalogAdapter.test.ts tests/familyInsights.test.tsx tests/openapi.test.ts
git commit -m "feat: expose family AI insights"
~~~

## Task 2: Detail Revalidation and Search Preview Parity

Files:
- Modify: lib/cache/familyDetailClient.ts
- Modify: lib/cache/familyDetailPersistence.ts
- Modify: lib/hooks/useFamilyDetail.ts
- Modify: lib/cache/familyPreviewCache.ts
- Modify: lib/hooks/useFamilyRoutePrefetch.ts
- Modify: components/search/SearchResultCard.tsx
- Create: lib/cache/familyDetailPreview.ts
- Modify: tests/familyDetailClient.test.ts
- Modify: tests/useFamilyRoutePrefetch.test.ts
- Create: tests/familyDetailPreview.test.ts

Consumes: Task 1 typed enrichment contract and existing user-scoped snapshot/cache
helpers.

Produces: loadFamilyDetail() still returns the fastest available full detail,
while refreshFamilyDetail() deduplicates a live request and updates the cache.
Search cards seed a rich, non-persisted detail preview.

- [ ] Step 1: Write failing cache tests.

~~~ts
it('returns a persisted detail first and refreshes it in the background', async () => {
  await writeSnapshot({ accountId: 'user-a', kind: 'family-detail', key: 'aeonik', payload: staleFamily, ttlMs: 60_000 });
  vi.stubGlobal('fetch', vi.fn(liveEnrichedResponse));

  await expect(loadFamilyDetail(input)).resolves.toMatchObject({
    kind: 'loaded', source: 'snapshot', family: { description: '' },
  });
  await refreshFamilyDetail(input);
  expect(getCachedFamily('user-a', 'aeonik')?.description).toBe('A precise neo-grotesk.');
});

it('turns a search item into a preview that keeps summary and semantic tags', () => {
  expect(familyDetailPreviewFromSearch(searchItem).description).toBe(searchItem.summary);
});
~~~

- [ ] Step 2: Run RED tests.

Run: rtk npm test -- tests/familyDetailClient.test.ts tests/familyDetailPreview.test.ts tests/useFamilyRoutePrefetch.test.ts
Expected: FAIL because snapshots never refresh and search previews only accept
ShelfFamily.

- [ ] Step 3: Separate fast read from live refresh.

Keep account keys and existing 30-day TTL. Add a source discriminant to loaded
outcomes: memory, snapshot, or network. Add refreshFamilyDetail(input) that
always calls the detail endpoint and shares an in-flight network promise by
uid:familyId. On success it atomically updates memory and both route/canonical
snapshot aliases. On refresh failure it leaves the visible cached family intact.

useFamilyDetail() must request a background refresh whenever it renders a
memory or persisted full family; cold requests use the existing first request.
Never replace family with a loader while that refresh is pending.

- [ ] Step 4: Preserve semantic preview fields without enlarging shelf payloads.

Create a pure familyDetailPreviewFromSearch(item) mapper. Change the prefetch
hook input from ShelfFamily to a narrow discriminated preview union:

~~~ts
type FamilyDetailPreviewInput =
  | { kind: 'shelf'; family: ShelfFamily }
  | { kind: 'search'; item: SearchResultItem };
~~~

The shelf mapper remains lightweight. The search mapper includes summary, moods,
useCases, and classification; neither persists a preview as a full-detail
snapshot.

- [ ] Step 5: Run focused GREEN tests.

Run: rtk npm test -- tests/familyDetailClient.test.ts tests/familyDetailClientMissing.test.ts tests/familyDetailRouteState.test.ts tests/familyDetailPreview.test.ts tests/useFamilyRoutePrefetch.test.ts
Expected: PASS. Include account isolation, concurrent refresh dedupe, stale
snapshot refresh, retryable refresh failure, route aliases, and search preview
metadata in assertions.

- [ ] Step 6: Commit.

~~~bash
git add lib/cache/familyDetailClient.ts lib/cache/familyDetailPersistence.ts lib/hooks/useFamilyDetail.ts lib/cache/familyPreviewCache.ts lib/cache/familyDetailPreview.ts lib/hooks/useFamilyRoutePrefetch.ts components/search/SearchResultCard.tsx tests/familyDetailClient.test.ts tests/familyDetailClientMissing.test.ts tests/familyDetailRouteState.test.ts tests/familyDetailPreview.test.ts tests/useFamilyRoutePrefetch.test.ts
git commit -m "fix: refresh family AI metadata in background"
~~~

## Task 3: Persistent App Frame and Deferred Upload Overlay

Files:
- Create: components/layout/AppFrame.tsx
- Create: components/upload/UploadCenterOverlay.tsx
- Modify: app/layout.tsx
- Modify: components/layout/CenteredShell.tsx
- Modify: components/home/HomePageContent.tsx
- Modify: components/home/LandingPage.tsx
- Modify: app/login/page.tsx
- Modify: app/(main)/search/page.tsx
- Modify: app/(main)/import/page.tsx
- Modify: app/(main)/family/[familyId]/page.tsx
- Create: tests/appFrameComposition.test.ts
- Modify: tests/importRouteBoundary.test.ts

Consumes: root Theme/Auth/Upload providers and existing NavBar behavior.

Produces: one persistent navigation chrome boundary that composes route children
and one interaction-loaded Upload Center overlay.

- [ ] Step 1: Write failing composition tests.

~~~ts
it('places NavBar in one root AppFrame and not in workspace route modules', () => {
  expect(read('app/layout.tsx')).toContain('<AppFrame>');
  expect(read('components/layout/AppFrame.tsx')).toContain('<NavBar />');
  for (const file of workspaceRoutes) expect(read(file)).not.toContain('components/layout/NavBar');
});

it('keeps UploadCenterModal behind an interaction-bound dynamic import', () => {
  expect(read('components/upload/UploadCenterOverlay.tsx')).toContain("dynamic(() => import('./UploadCenterModal')");
  expect(read('app/layout.tsx')).toContain('<UploadCenterOverlay />');
});
~~~

- [ ] Step 2: Run RED tests.

Run: rtk npm test -- tests/appFrameComposition.test.ts tests/importRouteBoundary.test.ts
Expected: FAIL because each route owns a NavBar and the root statically imports
the upload modal.

- [ ] Step 3: Create the composed frame.

AppFrame is a small client component with only children and the persistent
NavBar:

~~~tsx
'use client';

export default function AppFrame({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex flex-col"><NavBar />{children}</div>;
}
~~~

Render it once inside existing root providers. Remove duplicate NavBar imports
and outer navigation markup from route/content components. Keep every existing
route-specific main, scroll root, and screen-state class so viewport/scroll
behavior remains unchanged.

- [ ] Step 4: Defer the overlay, not its state/provider.

Implement UploadCenterOverlay as a client wrapper around next/dynamic with
ssr: false. It should render the existing modal unchanged after its chunk is
requested. Leave UploadProvider in place so the Uploads button still opens the
modal and background progress ownership does not change.

- [ ] Step 5: Run focused GREEN tests.

Run: rtk npm test -- tests/appFrameComposition.test.ts tests/importRouteBoundary.test.ts
Expected: PASS. No workspace route imports NavBar; the root composition frame
and lazy overlay are the only owners.

- [ ] Step 6: Commit.

~~~bash
git add components/layout/AppFrame.tsx components/upload/UploadCenterOverlay.tsx app/layout.tsx components/layout/CenteredShell.tsx components/home/HomePageContent.tsx components/home/LandingPage.tsx app/login/page.tsx app/(main)/search/page.tsx app/(main)/import/page.tsx app/(main)/family/[familyId]/page.tsx tests/appFrameComposition.test.ts tests/importRouteBoundary.test.ts
git commit -m "refactor: compose persistent application chrome"
~~~

## Task 4: Integration, Browser Verification, and Combined Release

Files:
- Modify: .agents/implementation-status.md
- Modify: .agents/frontend-ux.md
- Modify: .superpowers/sdd/final-fix-report.md

Consumes: Tasks 1-3 plus the existing cover/cache release on this branch.

Produces: verified local/browser behavior, durable architecture context, and a
complete release of the combined branch.

- [ ] Step 1: Run all quality gates.

~~~bash
rtk npm run lint:lines
rtk npm run typecheck
rtk npm run lint
rtk npm test
rtk npm run build
rtk npm test --prefix functions
rtk npm run build --prefix functions
rtk git diff --check main...HEAD
~~~

Expected: all commands pass. Record the known non-failing root Vitest
--localstorage-file warning separately if it remains.

- [ ] Step 2: Verify in the in-app browser.

1. Open /family/aeonik-pro directly from Shelf and confirm its summary, voice,
   moods, use cases, pairing hints, and confidence are visible when populated.
2. Search for aeonik, open the same result, and confirm the same information
   appears in the same detail route with no body loader replacing a preview.
3. Seed a stale detail snapshot in the browser test harness, open the route,
   verify cached specimen stays visible, then verify the live enriched copy
   reconciles in place.
4. Navigate Shelf -> Search -> Family -> Shelf and confirm exactly one nav bar,
   preserved scroll, no new React key warnings, and no runtime errors.
5. Open Uploads once and confirm the deferred modal opens and retains progress.

- [ ] Step 3: Update durable docs.

Record the metadata RCA, background revalidation behavior, AppFrame ownership,
and the explicit decision not to use Vercel Data Cache/Cache Components for
private Firebase-authenticated records.

- [ ] Step 4: Release the combined branch.

Push the branch. Fast-forward the verified branch to origin/main only after the
full gates and browser pass are green, then wait for Vercel production to become
Ready. Verify the public production alias and report any Vercel SSO limitation
separately from application behavior.

- [ ] Step 5: Commit release documentation.

~~~bash
git add .agents/implementation-status.md .agents/frontend-ux.md .superpowers/sdd/final-fix-report.md
git commit -m "docs: record detail parity architecture release"
~~~

## Plan Review

- Spec coverage: prior branch release, detailed metadata RCA, cache correction,
  search parity, App Router composition, bundle deferral, browser verification,
  and production release are each covered by a task.
- Type consistency: rich SearchResultItem remains a search payload; the new
  preview union prevents bloating ShelfFamily with semantic fields.
- Deliberate non-goals: no Firebase auth-cookie migration, no shared Vercel
  cache for private data, no blanket RSC rewrite, and no visual redesign.

