# Seriph In-App Browser Performance Audit

Date: 2026-07-10  
Environment: authenticated local development app at `http://localhost:3000`, exercised through the Codex in-app browser. Production public-shell check at `https://seriph.naw.al`.

## Scope and measurement limits

This was a non-destructive browser audit. It covered the catalog, pagination, family detail, search, filters, import route, invalid routes, mobile layout, and the signed-out production shell. No uploads, deletions, merges, sign-out/account switching, or network-offline tests were run because they alter account state or need a disposable test account.

The in-app browser does not expose a reliable way to install a `PerformanceObserver` before navigation, so real Largest Contentful Paint (LCP) could not be captured. The audit deliberately does not substitute an invented LCP value. CDP document, script, layout, task, DOM, request, and visible-content timing are included as lab proxies only.

Local-development timings are useful for regressions and relative cache wins, not production service-level claims. The production browser session was signed out, so it could validate only the public/static shell, not account data flows.

## Results at a glance

| Flow | Observed result | Assessment |
| --- | --- | --- |
| Catalog first visible cards | about 1,050 ms on initial local route | Usable, but slower than the cache-first target |
| Catalog cached reload | about 849 ms, no app API calls | about 201 ms / 19% faster than first route; cache works |
| Exact local search (`abc ginto nord`) | first matching result in 147 ms | Good |
| Fresh semantic search (`technical mono`) | first matching result in 144 ms; one `/api/v1/search` 200 observed for refinement | Good initial local response |
| Cached semantic search (`happy`) | previous results reused without an API request | Cache works |
| Search filter refinement | screen showed `0 results - refining` at 2.46 s; correct 3 results by 5.96 s | Regression: existing results should remain visible |
| Card to cached family detail | no app API request, but about 1.5 to 1.75 s to detail content | Cache works; client render/navigation remains too slow |
| Invalid family route | loader stayed visible until about 9 s, then recoverable error rendered | Regression: error must resolve promptly |
| Catalog pagination | scrolling reached hard end at 144 loaded cards while header says 232 families; no request, button, or end status | High-priority functional regression |
| Import route | content ready about 1.35 s; 683 ms task time and 576 ms script time | Functional, but heavy client work |
| Mobile catalog/detail at 390 x 844 | no document horizontal overflow | Pass for this basic responsive check |
| Production signed-out shell | static shell rendered cleanly; stats intentionally remained `-` | Pass, but not an authenticated production measurement |

## Confirmed regressions

### P0: Catalog stops after 144 of 232 families

The shelf header reports 232 families. After a real scroll to the bottom of `[data-shelf-scroll-root="true"]`, the DOM contained 144 family links. The last visible group was `M`; there was no load-more affordance, request, retry state, or explicit end state. The scroll container had reached its hard bottom.

This is a functional defect, not merely a performance concern. The likely implementation area is the interaction between persisted page hydration and `useInfiniteFamilies` cursor/`hasNextPage` handling. Verify the stored page count, next cursor serialization, and whether an incomplete cached first page is being treated as a complete library.

### P1: Search filters blank populated results during refinement

With results already present for `technical mono`, enabling the variable filter changed the URL correctly to `?q=technical+mono&variable=variable`. At 2.46 seconds the page showed `0 results - refining`; by 5.96 seconds it showed the correct 3 variable results.

This violates the cache-first interaction requirement. Applying a filter must retain the previous local or cached result set while the semantic refinement runs, then replace/rerank in place with stable result keys. The UI can indicate refinement, but it must not clear the grid.

### P1: Missing family route waits about 9 seconds before recovering

`/family/not-a-real-family-audit-20260710` displayed the detail loader for approximately nine seconds before showing the usable error and back-to-shelf action. No app family API request was observed during this test.

Resolve canonical/legacy lookup failures deterministically and surface the stable error frame quickly. A nonexistent route should not appear to be loading for the duration of an unrelated timeout.

## Important performance findings

### Cache behavior is real, but rendering is now the dominant cost

The cached catalog route made no application API request and reached cards in about 849 ms versus about 1,050 ms on the first local route. A cached detail route also made no application API request, but still took about 1.5 to 1.75 seconds to show its title/content.

The cached catalog reload recorded about 651 ms total task time, 361 ms script time, 21 ms layout time, and roughly 27,523 DOM nodes. The client is avoiding data latency but still doing too much route/render work. Profile this after the functional defects above are fixed, with emphasis on card-tree size, non-visible card work, and eagerly imported detail/import code.

### Detail navigation made two family reads on a first card click

The first card-to-detail trace showed reads for both `abc-ginto-normal` and `abc-ginto-nord`. This may be intentional adjacent/intent prefetch, but it should be confirmed. It is harmless when bounded and deduplicated; it is wasted work if the navigation invokes two identities for the same card.

### Import route has substantial script work

The import route was functional with two file inputs and a form, but CDP reported about 683 ms task time and 576 ms script time in local development. Defer nonessential import utilities and preview machinery until the user actually selects files.

### No-result query uses a fallback listing

The nonsense query `zzzxqv-no-such-font` settled without a loader or error but displayed 24 generic results. This appears to be the intended fallback-listing behavior rather than a failure. Product copy should make that state explicit, for example, by distinguishing suggestions from direct matches, so users do not assume the query matched those fonts.

## Positive checks

- Normal catalog, search, and detail flows produced no application console errors or failed application requests. The only observed development-only errors came from the injected local browser tooling during an intentionally very rapid input stress attempt; they are not evidence of a production application failure.
- Search uses the local index promptly for both exact and semantic queries, with the semantic request acting as a refinement rather than blocking initial content.
- Cached catalog, search, and detail paths suppress repeat application data requests as designed.
- The mobile catalog and detail documents remained 390 CSS px wide at a 390 x 844 viewport, with no document-level horizontal scroll.
- The signed-out production shell at `https://seriph.naw.al` rendered correctly with light client work in this limited check. Because it was signed out, the catalog stats remained `-` and no account data flow was exercised.

## Recommended repair order

1. Repair catalog pagination before any cosmetic performance tuning. Add a browser regression test that scrolls to the final page and asserts all 232 known families are reachable, plus a test for cached-first hydration followed by page continuation.
2. Change search refinement state so existing cards remain rendered while the filter/semantic response is pending. Add an assertion that a populated result grid never transitions to an empty grid solely because `isRefining` is true.
3. Make nonexistent family IDs resolve to the error/not-found frame quickly. Test canonical lookup, legacy fallback, and missing routes with a strict visible-frame budget.
4. Profile the cached catalog and detail renders once the above behavior is correct. Reduce non-visible card rendering and eagerly loaded client code before changing cache policy; cache is already eliminating the obvious network waits.
5. Split/defer import-only modules that do not participate in choosing a file.
6. Add production RUM for LCP, INP, route-to-content, cache-hit rate, semantic-refinement duration, and pagination continuation. That is the correct source of truth for production LCP and real-device network behavior.

## Follow-up test matrix

Use a disposable test account to complete the intentionally omitted scenarios:

- true cold cache, warm cache, expired cache, and cache-schema migration
- offline refresh and recovery
- sign-out clearing and account-isolation checks
- import with small, large, malformed, duplicate, and canceled selections
- merge, undo, deletion, permission denial, and mutation-driven cache invalidation
- authenticated production catalog/search/detail timing with network throttling
- production web-vitals collection for LCP, INP, CLS, and route transitions

