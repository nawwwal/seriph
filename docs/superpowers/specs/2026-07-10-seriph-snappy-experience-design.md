# Seriph Snappy Experience Design

Status: Ready for written-spec review. This document records the approved
design and constraints. A separate implementation plan will define exact code
changes, tests, and independent agent workstreams.

## Goal

Make Seriph feel immediate across the catalog, search, and family-detail flow:
render useful cached content first, refresh live data quietly, and never clear
an already useful view to show a loading state.

## Delivery Scope

The first delivery covers three connected surfaces:

1. The catalog shelf and its summary statistics.
2. Search, including instant local candidates and semantic refinement.
3. Family-detail navigation from a font card.

The same cache-first contract will then be reusable by other app surfaces.

## Approved Product Decisions

- A briefly stale snapshot is acceptable while live data refreshes in the
  background.
- Live updates may appear while a person is browsing, provided transitions are
  seamless and do not disrupt scroll position or context.
- Catalog snapshots may be retained for 30 days and must be cleared on sign
  out. The app refreshes them whenever it opens.
- Search-index snapshots should have a shorter lifetime of about seven days.
- The user should not see spinners or a loading screen in place of useful,
  already known content.
- The experience must favor responsiveness while reducing unnecessary backend
  reads and function invocations.

## Confirmed Cache Foundation

- Use IndexedDB for persistent, account-scoped data rather than treating
  localStorage as the primary cache.
- Scope every record to the authenticated account and include a schema version,
  fetch time, expiry, library revision, and stable entity identifiers.
- Cache catalog pages and summary data for 30 days; cache search candidates for
  seven days; retain a bounded set of recently opened family previews/details
  for 30 days.
- Render a snapshot immediately, refresh it in the background, and reconcile
  only changed entities. Do not clear a populated view while refreshing.
- Mutations (upload, delete, merge, edit) update or invalidate affected local
  entries immediately, then reconcile against the server revision.
- Keep destructive actions, authorization, upload status, and mutation results
  live. Cached data is a visual starting point, never the authority.
- Preserve stable card identities, scroll anchoring, and brief subtle
  transitions when live data changes visible content.

## Confirmed Catalog Flow

1. After authentication is known, render cached shelf pages and catalog summary
   from IndexedDB before the live request completes.
2. Fetch a compact persisted per-library catalog summary/read model and the
   applicable page cursor in the background.
3. Stop deriving header statistics by scanning every visible family during a
   catalog request. Summary state is maintained when library mutations occur.
4. When the live revision is unchanged, leave the UI untouched. When it has
   changed, merge only changed cards by stable family ID while preserving scroll
   position.
5. Prefetch the next catalog page after the shelf becomes idle, then store it
   alongside the current snapshot.
6. On a new device with no snapshot, show the complete shelf frame immediately
   without a spinner or animated skeleton, then crossfade cards in as the first
   response arrives.
7. On refresh failure, retain the last snapshot and retry later without
   replacing the shelf with an error state.

## Confirmed Search Flow

1. Search the persisted local candidate index synchronously as each query
   changes. Local results remain visible at all times and never wait for the
   semantic service.
2. Build that candidate index from compact family metadata that is already
   stored with catalog snapshots. It expires after seven days and refreshes in
   the background.
3. After a short typing pause, issue one deduplicated semantic request for the
   normalized query and current library revision. Do not run three lane-specific
   embedding and vector searches before presenting a useful result.
4. Redesign semantic retrieval around one primary, unified search vector for a
   fast initial refinement. Any richer mood/use-case reranking happens only
   after the user pauses and only updates the existing list in place.
5. Deploy the semantic service as close as practical to Firestore and the
   embedding service, cache normalized query results per library revision, and
   use a narrowly chosen warm-instance setting only after measuring its cost.
6. Preserve the local list if semantic refinement is unavailable or slow. A
   late semantic result may improve ranking, but may not blank, replace, or
   reset the search screen.
7. Target local result updates within one frame and make remote refinement a
   measured progressive enhancement rather than a typeahead dependency.

## Confirmed Family-Detail Flow

1. Preserve readable `/family/<slug>` URLs, but resolve the slug to the
   authenticated owner's deterministic canonical family document ID. Do not
   rely on a query fallback for ordinary card navigation.
2. Include the canonical family ID and a lightweight detail preview in every
   catalog and search card record. The preview becomes the immediate detail
   screen content on a card click.
3. Prefetch the detail snapshot on pointer, keyboard-focus, and touch intent
   using bounded concurrency. Cache a successfully fetched full detail record
   for 30 days, keyed by its individual revision.
4. On navigation, transition directly from the card into the available preview
   and cached detail state. Fetch fresh detail data in the background and merge
   changes without a loading replacement.
5. For direct deep links on a new device, resolve the canonical document in one
   deterministic read, render the detail frame immediately, and crossfade the
   returned data into it.
6. Record click-to-content timing, prefetch hit rate, direct-lookup fallback
   count, and detail-fetch failures so production behavior can distinguish a
   routing fault from a slow or failed data request.

## Confirmed Cache Integrity and Rollout

### Revisions and Invalidation

- Maintain a monotonic per-library revision in the persisted catalog summary.
  Every completed library mutation advances that revision and updates the
  summary in the same server-side operation.
- Use that revision to validate catalog, search-result, and detail snapshots.
  Cache entries for one account can never be used for another account.
- On app open, foreground return, and completed mutations, perform one cheap
  revision check before requesting any larger payload. Skip the larger request
  when the cache is current.
- Bound IndexedDB storage by evicting least-recently-opened detail records and
  older paginated shelf pages. Clear all account data on sign out.

### Failure Behavior

- Never clear usable cached content because a refresh fails. Retry with a
  bounded backoff and refresh again when the app regains connectivity.
- Treat authorization, destructive mutations, and upload state as live-only.
  If an action cannot be verified, do not optimistically present it as done.
- For a cache miss plus a failed first request, retain the static page frame and
  offer a clear retry action rather than an infinite loader.

### Performance and Cost Evidence

- Measure snapshot-cache hit rate, snapshot age, time to first useful catalog
  content, local-search update time, semantic refinement latency, card
  click-to-content time, refresh failures, and canonical-ID fallback use.
- Measure backend document reads, query-result cache hits, embedding calls,
  vector queries, Cloud Run invocations, and cold-start share per route.
- Initial targets: cached catalog content in 150 ms, local search within one
  frame, cached card-to-detail content in 100 ms, and remote semantic median
  under one second. Thresholds are revisited against production measurements.

### Validation and Rollout

- Add unit tests for TTL, user isolation, revision invalidation, eviction, and
  mutation reconciliation.
- Add integration and browser tests with slow or unavailable networks to verify
  that cached catalog, search, and detail content never regress to a loader.
- Release behind a reversible cache-first flag, verify real-user timings and
  billing metrics, then expand while retaining the existing live path as a
  rollback route.

## Known Technical Findings

- There are some existing narrow caches, but they do not form a persistent,
  app-wide cache-first contract.
- The current catalog statistics path can read the full visible library, making
  it a poor first-render dependency.
- Search is dominated by remote semantic work: multiple lane-specific embedding
  operations and vector queries, cold starts, and cross-region hops.
- A font card normally routes by slug while the family detail endpoint may need
  a fallback lookup before it reaches the canonical document.

## Pending Design Sections

- None. The design is complete and ready for written-spec review.
