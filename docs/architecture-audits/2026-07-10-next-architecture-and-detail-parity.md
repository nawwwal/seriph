# Next Architecture and Detail Parity Audit

Date: 2026-07-10
Scope: the cache-first catalog/search/detail release plus the authenticated App Router surface.

## Previous Release Status

The cover-pattern and cache-first release is implemented, fully gated, pushed as
codex/seriph-patterns-and-regressions, and deployed as a Vercel preview. It is
not yet on main, so the combined release remains part of this goal.

## Confirmed Metadata RCA

Catalog and search do not use different detail pages. Both link to
/family/[familyId]; the mismatch happens before that route renders.

1. Search reads family.enrichment directly in the Cloud Function and returns
   summary, moods, and useCases in SearchResultItem.
2. The family-detail API calls adaptFamilyDoc(). For current catalog documents,
   mapCatalogDoc() is lossy: it maps only summary, classification, moods, and
   use cases. It drops voice, pairingHints, confidence, model/version, and
   enrichment time.
3. The detail UI has no component for the omitted fields. FamilyHeader renders
   only mood/use-case chips and FamilyFooter renders only the description.
4. Search-card navigation converts a rich SearchResultItem to a bare
   ShelfFamily, so the immediate route preview drops the search summary and
   tags too.
5. The persistent detail snapshot has a 30-day TTL. loadFamilyDetail() returns
   that snapshot or memory entry without making a background request, and
   useFamilyDetail() skips its request when a memory entry exists. A family
   enriched after the snapshot was written can therefore keep showing
   No description yet for the full TTL.

Browser reproduction on Aeonik Pro: /family/aeonik-pro rendered the empty
description fallback while /search?q=aeonik rendered AI-written result
summaries. This is a contract/cache problem, not an enrichment-job problem.

## Architecture Findings

### Keep the client-owned account cache

Do not move owned font data into Vercel's shared Data Cache. Vercel documents
that the Data Cache is shared by users of the same project; Seriph's Firebase
client-auth and IndexedDB account-scoped snapshot architecture is the correct
privacy boundary for catalog/search/detail data. Use the Vercel CDN for assets
and the client cache for account data. Reconsider server caching only after a
server-verifiable session/cookie boundary exists.

### Keep server components surgical

All interactive routes are client components because Firebase Auth, IndexedDB,
font registration, drag/drop, and live tester state are browser-owned. A
blanket RSC conversion would add an auth bridge and risk the instant cache-first
experience. The practical gain is a persistent App Router layout that owns the
navigation chrome and receives route content as children, with client-only
behavior contained at the leaves.

### Remove duplicated navigation ownership

NavBar is mounted in the home, landing, login, import, search, family-detail,
and centered-error shells. That repeats structural markup and remounts the nav
on every route transition. Replace it with one root AppFrame composition
boundary. Pages keep route content; the frame owns persistent chrome.

### Defer a noncritical overlay

UploadCenterModal is imported by the root layout even though it is useful only
after a user opens Uploads. Keep its provider and behavior unchanged, but lazy
load its overlay component behind a small client wrapper.

### Existing good decisions to preserve

- Search input state stays local-first; semantic results are a refinement.
- Import workspace and ZIP generation are already interaction-bound dynamic
  imports.
- Detail/shelf APIs parallelize independent data reads where appropriate.
- Do not enable cacheComponents in this pass: cache semantics need a server
  auth model before private records can be safely treated as server cacheable.

## Research Applied

- Vercel Component Composition Patterns:
  https://vercel.com/academy/nextjs-foundations/component-composition-patterns
  recommends small client wrappers with composed children rather than prop
  configuration or monolithic route shells.
- Vercel React Best Practices:
  https://vercel.com/blog/introducing-react-best-practices
  calls out unnecessary sequential work, oversized client bundles, and
  avoidable rerenders as repeat session costs.
- Vercel Next.js performance guide:
  https://vercel.com/blog/guide-to-fast-websites-with-next-js-tips-for-maximizing-server-speeds
  recommends client components at leaf boundaries and lazy-loading heavy UI that
  is not needed for the initial render.
- Vercel Next.js on Vercel guide:
  https://vercel.com/docs/frameworks/full-stack/nextjs
  confirms that Next.js 16 Cache Components are opt-in and dynamic by default;
  they are deliberately deferred until Seriph has a server-side auth boundary.

## Target Outcome

Every navigation path shows the same AI-enriched family detail immediately when
available, then reconciles with live data in the background without blanking the
specimen or tester. The application has one persistent navigation frame, no
duplicated route chrome, and no private user data in a shared server cache.
