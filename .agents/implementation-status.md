# Seriph — Implementation Status (as-built)

> Living record of what's actually built vs. the target in
> [architecture.md](./architecture.md) / [models-and-stack.md](./models-and-stack.md).
> Last updated: 2026-07-01. Update this whenever the build state changes.

## Status at a glance

The Google-Fonts-style, store-first pipeline is **live**. The backend, Firebase
Hosting CDN routes, Firestore vector indexes, and Vercel web app were deployed
on 2026-06-28. A live upload smoke test created and enriched `letters-home`,
served WOFF2/original assets, emitted `/css2` `@font-face`, and returned the
font from semantic search.

Gates before cutover: functions `tsc` build + 30 vitest tests pass · web
typecheck + lint (0 errors, 15 pre-existing warnings) + test + build pass.

Live endpoints:
- App: `https://seriph.naw.al`
- Font CDN / CSS API: `https://seriph.web.app`
- Search function: `https://asia-southeast1-seriph.cloudfunctions.net/searchFontsHttp`

## Code modularity lint (local, 2026-07-01)

- Root `package.json` now has `npm run lint:lines`, and `npm run lint` runs it
  before web and Functions lint. The checker warns for TS/TSX/JS/JSX/MJS/CJS/CSS
  source files over 100 non-empty lines and fails files over 150, excluding
  generated/vendor output.
- Existing over-limit files were split by responsibility: shelf rendering,
  infinite-family loading, shelf page parsing/cache helpers, family merge face
  merging, Remote Config setup data/template helpers, CSS utility families, and
  behavior-specific tests.
- The durable engineering rule is not "make files short at all costs"; it is
  "prefer small, reusable modules with explicit domain roles." Use TypeScript
  classes only when a real object has identity/lifecycle/invariants; otherwise
  prefer typed functions, objects, and interfaces.

## Base UI primitive boundary (local, 2026-07-01)

- Base UI is now the behavior substrate for the main shared controls while
  Seriph's class/token contract remains the visual source of truth. Added
  `components/ui/TextInput.tsx` and `components/ui/textInputStyles.ts` around
  Base UI Input, migrated search/auth/confirmation text fields, moved
  `components/ui/Modal.tsx` to Base UI Dialog, moved destructive family delete
  confirmation to Base UI AlertDialog, moved `ThemeSwitcher.tsx` to Base UI
  Select, and moved `ProfileMenu.tsx` to Base UI Menu.
- Native/browser-owned controls remain intentional until a bespoke Seriph
  wrapper can preserve appearance: Type Tester selects, range sliders,
  checkbox filters, hidden file inputs, and the coordinate shelf context menu.
- Verification passed locally: focused primitive style tests, root typecheck,
  web lint, full Vitest suite, production build, `git diff --check`, and
  in-app browser verification of the theme Select popup/value restore on
  `http://localhost:3000`.

## Flicker/stable navigation pass (local, 2026-07-01)

- Root cause for the shelf/search → family flicker: cold family detail routes
  replaced the whole route with `FontDetailLoader`, including a skeleton nav, so
  Shelf/search/uploads/profile/theme chrome disappeared until full family data
  arrived. The loader is now body-only and `/family/[familyId]` keeps the real
  `NavBar` mounted through loading/error/auth shells.
- Family card and nav-suggestion intent prefetch now warms the same deduped
  `loadFamilyDetail()` cache that the detail hook reads. Returned details are
  cached under both the requested route id and canonical family id to avoid
  slug/doc-id cache misses.
- Theme flicker root causes: the pre-hydration script read only the legacy
  `theme` key, while the provider persists `seriph-theme:v1`; and hover preview
  repainted the Base UI popup with the previewed page theme. The startup script
  now reads `seriph-theme:v1` first, and the popup is pinned to the committed
  theme while body preview remains available.
- Search flicker guardrails: `/search` no longer has a `null` Suspense fallback,
  result cards key by `slug || id` across local/semantic refinement, and the
  empty state waits for semantic refinement to settle.
- Verification: red-green `tests/familyDetailClient.test.ts` for route-id cache
  aliases, focused primitive/theme tests, `npm run typecheck`, `npm run
  lint:lines`, `npm run lint:web`, and in-app browser traces on
  `http://localhost:3000` for shelf → family → shelf plus theme-menu state.

## Muted skeleton/control track correction (local, 2026-07-01)

- Root cause for the odd lavender/colored skeleton and slider/progress tracks:
  `--muted` was theme-specific palette color in most themes, so skeleton bars,
  range tracks, hover fills, and upload progress tracks looked like separate
  accents instead of quiet inactive UI.
- `--muted` is now consistently `color-mix(in srgb, var(--ink) 16%,
  transparent)` across all theme definition files. `--control-track` aliases
  that token for sliders and progress tracks. Shared `.theme-range`,
  `.progress-bar`, upload-center rows, and upload-queue rows now use the same track/fill
  contract: low-opacity ink track, ink fill.
- Verification: red-green `tests/themeColorGuard.test.ts`, in-app browser token
  check on Lilac showing `--muted` and `--control-track` as black at 16%
  opacity, plus `npm run typecheck`, `npm run lint:lines`, `npm run lint:web`,
  `npm test`, and `npm run build`.

## Focus ring token correction (local, 2026-07-01)

- Root cause for the blue Lilac search input focus ring: the shared
  `theme-focus-ring` utility correctly used `--focus`, but every theme still
  assigned `--focus` to a hard-coded accent/palette color. Lilac was
  `#2D1FE8`, which produced the bright blue outline.
- `--focus` now resolves to `var(--ink)` in every theme definition file. Focus
  rings therefore follow the active foreground token, matching the same
  theme-variable contract as skeletons, slider/progress tracks, overlays, and
  shadows.
- Verification: red-green `tests/themeColorGuard.test.ts` now guards both
  `--muted` and `--focus`; in-app browser verification on Lilac forced
  `:focus-visible` on the nav search input and read a solid `2px` black outline
  from `--ink`.

## Splash wordmark motion correction (local, 2026-07-01)

- Root cause for the outdated splash: auth/loading gates still used the generic
  `LoadingSpinner`, producing a centered circular spinner plus "Loading Seriph"
  text that felt disconnected from the editorial wordmark direction.
- Added reusable `SplashWordmark` and `LoadingSplash` components. The wordmark is
  rendered as data-driven per-letter spans with an Interface Craft storyboard at
  the top of the component. The loop creates a left-to-right wave across
  `SERIPH`, with each letter rising and settling before the sequence repeats.
- Motion is CSS-only and transform-only: `styles/utilities-splash.css` animates
  `translate3d`, uses theme `--ink`, and includes `prefers-reduced-motion` to
  show a static wordmark for reduced-motion users. Auth gates on `/`, `/login`,
  and `/search` now use `LoadingSplash`.
- Verification: focused splash/theme tests, `npm run lint:lines`, `npm run
  typecheck`, `npm run lint:web`, full `npm test`, `npm run build`, `git diff
  --check`, and in-app browser CSS checks on `http://localhost:3000` confirming
  the splash keyframes, transform rise, and reduced-motion rule are loaded.

## Durable import cutover (local, 2026-07-19)

- The upload journey now creates owner-scoped durable batches, registers source
  inventory, seals the source set, and uploads to private intake storage. The
  canonical HTTP surface is `/api/v1/import-batches/**`; the global Upload Center
  reads the same batch/source/item/family-plan feed.
- Remote Config defaults `durable_import_enabled` to on. If the browser cannot
  fetch Remote Config, the client keeps the durable path available and the import
  workspace reports setup or post-start failures instead of silently dropping a
  selected file.
- Verification: focused durable import, route-boundary, and OpenAPI tests cover
  the canonical route tree and the visible failure boundary.

## OpenType family metadata repair (local/live data, 2026-07-01)

- Family grouping now treats OpenType typographic names as the source of truth:
  name-table preferred family/subfamily fields are stored on `face.meta` during
  ingest and are trusted ahead of legacy family/subfamily strings. Legacy
  suffix repair remains only as a fallback for old records without preferred
  names.
- `merge:split-families --reparseOriginals` reparses each face's original font
  binary before planning a merge, so existing degraded catalog records are
  repaired from the actual font metadata instead of filename/name-word guesses.
  The planner now targets the owner-scoped canonical document and hides legacy
  same-slug duplicate docs as aliases after merging their faces.
- Live repair was applied for Aeonik Pro and Audacious. The actual binaries
  report `preferredFamily: "Aeonik Pro"` for Light/Black/Medium/Thin/Air and
  `preferredFamily: "Audacious"` for Black/Medium/SemiBold/Display cuts. Current
  visible owner-scoped docs are `aeonik-pro` with 16 faces and `audacious` with
  20 faces; legacy split/duplicate docs are hidden aliases.
- Verification: focused Functions tests for canonical identity, split-family
  merge planning, original-binary reparsing, and duplicate-doc reconciliation
  pass; `npm run lint:lines`, `npm run lint --prefix functions`, and
  metadata-based live dry runs completed with zero conflicts before apply.

## Shelf stats and loading performance (local, 2026-06-30)

- Top-row shelf stats are no longer derived from the loaded infinite-scroll
  page. `GET /api/v1/families/stats` returns a stable per-user summary for
  visible families, filters aliases/hidden merged docs with the same rules as
  the shelf list, and uses a short server cache invalidated by family
  edit/merge/undo/delete routes.
- `useInfiniteFamilies()` starts the first page and stats requests in parallel
  with one ID-token promise. The first page writes to local cache immediately;
  stats upgrade that cache once available. Pagination and refresh now use
  separate abort/request IDs.
- New family writes and manual merges persist `styleCount`; old docs still count
  from `faces.length` in the stats fallback. Shelf covers are memoized. A prior
  attempt to add CSS `content-visibility` / `contain-intrinsic-size` to card
  wrappers was removed on 2026-07-01 because it inflated catalog grid rows and
  made the existing hover scale feel different.
- Local browser verification at `http://localhost:3000`: 48 first-page cards
  rendered with full-library stats `Families 1169`, `Styles 1897`, `Recently
  Added ABC Ginto Plus`; scrolling to 96 cards kept stats unchanged. Warm reload
  showed cards and stats at about 244 ms after DOMContentLoaded and about 721 ms
  total.
- Correction verification on 2026-07-01: the in-app browser showed first shelf
  cards at `220 x 216`, wrapper class `h-full`, and no `.shelf-card-shell`.
- Load-more correction on 2026-07-01: the text loader remains removed, but the
  bottom of the shelf now renders eight card-shaped skeleton placeholders while
  more pages are available/loading, using the same responsive shelf grid as real
  cards so fast scrolling does not land on an empty bottom.

## Search workspace and typeahead performance (local, 2026-07-01)

- Search is now split into a top-nav typeahead preview and a committed
  `/search` workspace. Nav typing shows preview suggestions from the cached
  prepared local index and does not mutate the current results URL until Enter
  or the commit row.
- `/search` owns query plus filters/facets: classification, mood, style count,
  and variable/static. Filter state is URL-addressed and is applied to local
  results, semantic refinement results, and the backend search request contract.
- Local ranking now prepares normalized tokens/trigrams once per index item and
  uses cheap exact/prefix/token matching before fuzzy scoring, keeping the
  input event path responsive without removing semantic search.
- In-app browser verification: typing `geometric sans` in the main search field
  produced max paint delay about 27 ms, average about 20 ms, and 0 long tasks;
  typing `ivar` in nav preview kept the URL unchanged until Enter, produced max
  paint delay about 3 ms, and rendered suggestion names in their own font faces.
- Production incident RCA on 2026-07-01: after the search workspace reached
  production, `searchFontsHttp` repeatedly exceeded the default 256 MiB Gen2
  memory limit under multi-lane semantic requests, terminating the instance and
  surfacing `Search failed` on `/search`. Fix commits `25bf90c` and `a7e09a7`
  set the search function to 1 GiB / 90s / concurrency 1 / maxInstances 4,
  made semantic refinement failures non-blocking when the local index can render,
  and added a compact local mood bridge so natural queries such as `happy`
  produce instant local candidates while semantic ranking refines. Production
  verification: Firebase lists `searchFontsHttp` at 1 GiB, Vercel deployment
  `dpl_GynmwXqQBtdxp5wnHcPcTKw2SEuG` is Ready on `https://seriph.naw.al`, live
  `happy` search rendered 24 local cards with no `Search failed`, and post-deploy
  function logs showed successful `search complete` entries rather than memory
  kills.
- Hover-state standardization on 2026-07-01: style cards, `FamilyCover` catalog
  cards, search result cards, and the Drop Fonts catalog tile now use the shared
  `.seriph-card-hover` utility. The canonical hover is the screenshot-approved
  style-card treatment: lift `translateY(-4px)` with a hard
  `0 4px 0 var(--ink)` base shadow; the old `hover:scale-[1.02]` catalog hover
  was removed.
- Follow-up shelf performance pass on 2026-07-01: visible families render in
  alphabet sections, the bottom loader marker is hidden and prefetches at a
  `2800px` margin, appended pages persist into the shelf cache, returning from
  a detail page restores the nested shelf scroll position, and shelf preview
  `@font-face` rules persist for the session. In-app browser verification:
  192 cached family cards, headings `A/B/C`, no visible "Loading more families"
  text, click `/family/aviorte`, return to `/`, and inner scroll restored to
  `scrollTop: 3400`.
- Scroll restoration hardening on 2026-07-01: the nested shelf scroller is now
  tagged with `data-shelf-scroll-root`, shelf cards expose
  `data-shelf-family-id`, and `useShelfScrollRestoration()` stores only the v2
  JSON snapshot contract (`top`, `anchorFamilyId`, `anchorOffset`, `updatedAt`).
  Restoration runs as a layout effect, waits until real family cards exist,
  restores by anchor before pixel fallback, and can request more pages until the
  saved anchor is mounted. No backward-compatible legacy numeric snapshot path
  remains. In-app browser verification: scrolled to `scrollTop: 4560`, opened
  `/family/bb-manual-mono-pro-hl-sm`, clicked Shelf, and returned to
  `scrollTop: 4560` with the same BB Manual Mono row visible.

## Shelf grouping and destructive family actions (local, 2026-06-30)

- Shelf cards now support a right-click context menu. `Select` enters
  multi-select mode; selected visible families can be merged or hard-deleted.
- Merge is exposed as `/api/v1/family-merges` plus
  `/api/v1/family-merges/{mergeId}/undo`. It verifies owner scope, merges
  `faces[]`, hides source families as aliases, clears stale enrichment/vector
  fields, and marks the target `ready` for scheduled enrichment.
- Hard delete is exposed as `/api/v1/families/bulk-delete`; it requires
  `confirm: "DELETE"` and removes owned family docs plus referenced original and
  woff2 assets.
- AI enrichment now accepts `suggestedDisplayName` and applies it only when a
  manual merge has `displayNamePending`.

## What shipped

### Backend (`functions/src/`)
- `storage/canonicalize.ts` — Google Fonts model: weight map (Thin 100…ExtraBlack
  1000), style parsing, family slug/filename tokens, static `Family-SemiBold.woff2`
  + variable `Family[opsz,wght].woff2` naming, axis ordering, GF category. (unit-tested)
- `storage/transcode.ts` — woff2 via `wawoff2` (wasm; TTF/OTF in, woff2 out).
- `storage/ingest.ts` — store-first ingestion: parse → canonicalize → woff2 →
  write public bucket (`s/**` + `d/**`) → upsert family doc (`ready`).
- `storage/familyStore.ts` — transactional family upsert/merge (`fontfamilies/{slug}`).
- `models/catalog.models.ts` — the new schema (see below).
- `render/specimen.ts` — specimen PNG via `@napi-rs/canvas` (skia, prebuilt).
- `ai/embeddings.ts` — text embeddings via `@google/genai` (Vertex).
- `ai/enrichFont.ts` — async enrichment: specimen → one multimodal Gemini pass
  (structured JSON) → text embedding → write `text_vec` + enrichment, status `enriched`.
- `search/searchFonts.ts` — Firestore-native vector search (`findNearest`, cosine)
  with structured pre-filter + listing fallback.
- `serve/css2.ts` — Google-Fonts-style CSS API parse/generate. (unit-tested)
- `serve/handlers.ts` — `/css2`, `/s/**`, `/d/**` (download) handlers.
- `config/catalogConfig.ts` + extended `config/rcKeys.ts` — CDN base, public
  bucket, path builders, new RC keys.
- `index.ts` — exports `confirmFinalizedImportSource` (intake finalization),
  `importTaskWorker`, `timeoutAbandonedImportSources`,
  `submitEnrichmentBatch`, `pollEnrichmentBatch`, `searchFontsHttpUs`, `css2`,
  and `serveFont`.
- `ingest/batchEnrich.ts` — **all-batch enrichment lane.** Replaced the realtime
  `enrichFontOnReady` Firestore trigger (removed). On a schedule, collect `ready`
  families → render specimens → one GCS JSONL → Vertex **Batch API** job for the
  multimodal analysis (50% of realtime price, `location: global` for
  `gemini-3.5-flash`); a poller parses the output, embeds inline (2048-dim), writes
  enrichment + `text_vec`, and finalizes ingests. Fonts stay instantly viewable;
  enrichment lands on the batch cadence. Verified live 2026-06-28 (job applied 2/2).

### Front-end (web) — design unchanged
- `lib/db/catalogAdapter.ts` — maps the new doc shape → the existing `FontFamily`
  UI shape (CDN urls surfaced on `metadata.cdnUrl` / `downloadUrl`).
- `lib/db/firestoreUtils.ts` — reads top-level `fontfamilies` (by `ownerId`) via adapter.
- `lib/hooks/useRegisterFamilyFonts.ts` + `components/font/VariableFontPlayground.tsx`
  — load fonts from immutable CDN URLs.
- `components/font/UseFontPanel.tsx` — copy CSS `<link>`, copy woff2 URL, download.
- `app/(main)/search/page.tsx` + nav link — semantic search UI → `/api/v1/search`.

### Infra-as-code
- `firebase.json` — Hosting rewrites `/s/**`, `/d/**`, `/css2` → functions; CORS headers.
- `firestore.indexes.json` — `text_vec` vector indexes (single-field + `ownerId`/
  `category` composites, **dimension 1536**).
- `scripts/setup-catalog.sh` — public bucket + IAM + CORS + SA write.
- `hosting/index.html`, updated [deployment.md](deployment.md).

### Retired (deleted)
The earlier multi-stage AI and proxy-upload surfaces were removed. Current
enrichment runs through the durable import task pipeline and current web API
routes are versioned under `/api/v1/**`. Vertex File Search is no longer used.

## As-built data model

`fontfamilies/{slug}` (top-level, public-readable), with `ownerId`:
- `faces[]` — each: `id`, `styleName`, `weight`/`weightName`, `italic`, `isVariable`,
  `axes[]`, `format`, `postScriptName`, `filename`, `woff2`/`original`
  (`{storagePath, url}`), `contentHash`, `meta` (characterSetCoverage,
  openTypeFeatures, glyphCount, languageSupport, …).
- `enrichment` — category, classification, summary, moods, voice, useCases,
  pairingHints, confidence, model/embedding versions.
- `text_vec` — `FieldValue.vector` (set after enrichment).
- `status` — `ready | enriching | enriched | failed`; `coverFaceId`; `version`.
- Served manifest type `FamilyManifest` (METADATA.pb equivalent) defined; writing
  `family.json` to the bucket is wired via the schema but optional.

Asset paths use a **content-hash version segment** (`s/<slug>/<hash8>/<file>`) →
immutable, cache-bustable.

## Key decisions made during the build
- **Top-level `fontfamilies`** (not user subcollections) → one collection for
  `findNearest` + a single enrichment trigger.
- **Store-first**, enrichment via a guarded Firestore trigger (acts only on `ready`).
- **Default models** (RC, overridable): analysis `gemini-2.5-flash`, embedding
  `gemini-embedding-001`, **dims 1536**. Bump to Gemini 3.x / Gemini Embedding 2
  via Remote Config — but `embedding_dimensions` MUST equal the vector index
  dimension, else re-create the index.
- **woff2 = `wawoff2`**, **specimen = `@napi-rs/canvas`** (both prebuilt, gen2-safe).
- Serving = **Firebase Hosting CDN** + **`/css2` CSS API** (Google Fonts parity).

## Go-live status

Completed on 2026-06-28:
1. `bash scripts/setup-catalog.sh seriph` created `gs://seriph-fonts`, made it
   public-read, granted the functions service account write access, and set CORS.
2. Functions + Firebase Hosting deployed. The current deployed import functions
   are `confirmFinalizedImportSource`, `importTaskWorker`, and
   `timeoutAbandonedImportSources`.
3. Firestore indexes deployed. The vector index config needed one correction:
   `text_vec` vector indexes live in top-level `indexes`, not `fieldOverrides`.
4. `SEARCH_FUNCTION_URL` was set in Vercel for production, preview, and development.
5. Vercel production deployed and aliases include `https://seriph.naw.al`.

Live smoke evidence:
- `Letters Home` uploaded through the live Storage trigger path.
- Public assets:
  - `https://seriph.web.app/s/letters-home/e58b23bb/LettersHome.woff2`
  - `https://seriph.web.app/d/letters-home/e58b23bb/LettersHome.otf`
- `https://seriph.web.app/css2?family=Letters%20Home` returns `@font-face`.
- `POST https://seriph.naw.al/api/v1/search` finds `letters-home` with an embedding
  score and enrichment summary/moods.

Current RC note: `is_vertex_enabled` is already `true` in the existing `Server`
Remote Config group. New rebuilt keys such as `catalog_public_bucket`,
`analysis_model_name`, `embedding_model_name`, and `embedding_dimensions` are
currently using code defaults (`seriph-fonts`, `gemini-2.5-flash`,
`gemini-embedding-001`, `1536`) unless explicitly added.

## Ingestion + upload status + detail UI pass (2026-06-28)
- **Durable ingestion:** the browser registers batches and source inventory under
  `/api/v1/import-batches/**`, uploads to `intake/**`, and the finalized-source
  trigger dispatches archive, parse, plan, apply, and enrichment tasks. See
  [ingestion-at-scale.md](./ingestion-at-scale.md).
- **Upload status overhaul:** single two-lane state machine; server now emits
  `analyzing`/`enriching`; global Upload Center modal (nav "Uploads" button)
  replaces scattered status; `BatchHUD` is now a shortcut. Legacy `status` no
  longer drives display.
- **Family detail UI:** wired the variable playground (was orphaned); redesigned
  "Use this font" (no white code bars, URL truncation).
- **Avatar:** Google photo now uses `referrerPolicy=no-referrer` + initials
  fallback (`onError`).

## Frontend audit pass (2026-06-28)
- **Catalogue is now login-gated.** Logged-out `/` shows
  `components/home/LandingPage.tsx`; `/search` and `/family/[familyId]` gate too.
  See [frontend-ux.md](./frontend-ux.md).
- **Variable-font false positives fixed** in `functions/src/parser/fontParser.ts`
  (require non-empty `variationAxes`). Fonts ingested before this keep the wrong
  `isVariable` until re-ingest/migration (see deferred follow-ups).
- **Search moved into the top nav** as an inline field; `/search` reads `?q=`.
- **Theme tokens extended** with semantic status vars (`--success/--danger/
  --warning/--info`) and all hardcoded Tailwind palette colors removed.
- Previously-dead buttons wired (Test in Text, Add Style, Download zip via
  `jszip`, Share, Regenerate Covers).

## Auth provider update (2026-06-29)
- **Google popup UI replaced with email/password auth.** `components/auth/AuthForm.tsx`
  backs `/login` with sign-in, create-account, and password-reset modes using
  Firebase Auth email/password APIs. Logged-out CTAs route to `/login`; the
  Firebase ID-token contract for API routes, Firestore rules, and Storage rules is
  unchanged.
- **Firebase Auth email/password provider enabled** on project `seriph` via
  `npx -y firebase-tools@latest deploy --only auth --project seriph --non-interactive`.
- **UID-preserving cutover helper added:** `npm run auth:set-password --prefix
  functions -- --uid=<existing-uid> --password=<new-password> --dryRun` checks
  the target, and the same command without `--dryRun` sets a password on the
  existing Firebase Auth user so owner-scoped font data remains attached.

## Security hardening + code-health pass (2026-06-28)
- **Firestore rules**: removed the world-readable `match /{document=**}` catch-all;
  `fontfamilies` reads are now **owner-scoped** (`userOwns(resource.data.ownerId)`),
  and `users/**`, `ingests`, per-user `batches`, and `batchJobs` are locked down.
  Deployed + verified (unauthenticated read of a family returns 403).
- **Storage rules**: added `storage.rules` (registered in `firebase.json`) — authed
  users may write only their own `intake/{batchId}/**`; processing prefixes are
  admin-only; default deny. The public CDN is the separate `seriph-fonts` bucket
  (IAM-based), unaffected. Deployed.
- **API routes**: versioned `/api/v1/**` handlers require a verified token and
  inject `ownerId` server-side. The import batch handlers expose bounded reads,
  source registration, sealing, terminal source failure, retry, and cancellation;
  private intake uploads do not require public object reads.
- **Modularity refactor**: split large files into focused modules across `functions/src`
  and the web app; the checker warns above 100 and fails above 150 (with four
  documented exemptions for pure type files
  `models/font.models.ts` ×2 / `catalog.models.ts`, config registry `rcKeys.ts`,
  and the single-concern `lib/firebase/admin.ts`). Behavior preserved (web typecheck/
  lint/test + functions build/lint/31 tests green).
- **Dead code removed**: web `lib/db/firestoreUtils.admin.ts` + legacy
  `families/styles/searchSignals` queries; functions realtime Vertex path
  (`generateStrictJSON`/`getGenerativeModelFromRC`/`ai/utils/retry.ts`), unused
  remoteConfig threshold helpers, and trimmed `contracts.ts`/`font.models.ts`.

## Deferred follow-ups (none block launch)

- **Sub-second family detail navigation.** Locally achieved for perceived first
  paint in `next dev --turbopack`: catalog/search/nav entries seed a lightweight
  preview from shelf/search data, prefetch route + detail data on user intent,
  and `useFamilyDetail` reads preview, full cache, and in-flight detail requests
  through one owner-scoped path. Canonical and alias route ids are cached
  together, lower detail sections skeletonize until the full payload arrives,
  and the zip helper moved behind the Download click. In-app CDP timing measured
  `/family/acid-grotesk-thin` preview paint at 66 ms after the actual click;
  full lower-section hydration completed at 1322 ms. Remaining structural work
  is reducing/API-caching the owner family read path enough that full hydration,
  not just perceived navigation, is also consistently under one second.

- **Migration/reprocess** of existing fonts into the new schema: admin workflow
  exists at `functions/src/scripts/migrateOldSchemaFonts.ts` and is exposed as
  `npm run migrate:old-schema-fonts --prefix functions -- ...`. It scans legacy
  `users/{uid}/fontfamilies/*` docs, downloads each legacy font
  `metadata.storagePath`, re-ingests through the current parser/canonical CDN
  path, fixes stale `isVariable` flags by requiring non-empty axes, maps useful
  legacy description/tags/use-case metadata into current enrichment, recomputes
  `searchText`, `searchTokens`, `searchMeta`, `text_vec`, `mood_vec`, and
  `use_case_vec` unless `--skipVectors` is passed, and stamps the legacy doc with
  `oldSchemaMigration` so reruns are idempotent unless `--force` is used.
  Production run shape:
  `npm run migrate:old-schema-fonts --prefix functions -- --ownerId=<uid> --dryRun --skipVectors`,
  then
  `npm run migrate:old-schema-fonts --prefix functions -- --ownerId=<uid>`.
  For a full production sweep, use explicit `--allOwners` instead of `--ownerId`.
  Dry-run smoke on 2026-06-29 found
  `users/j2oQFEPASOWu0YrS4Vw3UV1zDx02/fontfamilies/nunito-sans-12pt-extralight`
  would migrate to `fontfamilies/nunito-sans-12pt-extralight` with 1 font and 0
  writes.
- **Image (multimodal) embeddings** — `image_vec` stubbed; currently text-only.
- **WOFF1 → woff2** (currently serves original for WOFF1 input).
- **Per-subset woff2** and **per-weight vectors** (currently full-face + family-level).
- **Custom CDN domain** (default `https://<project>.web.app`).
- **MCP / agent access** — out of scope here; next phase (see
  [search-and-agents.md](./search-and-agents.md)).

## Dependency pins (don't bump blindly)
ESLint pinned to **9.x** (Next config has no ESLint 10–compatible
`eslint-plugin-react`). `firebase-admin` **13.x in `functions/`** (peer of
`firebase-functions@7`), **14.x in the web app**. Tailwind 4 / flat ESLint config.

## Cache-first detail and App Router composition (local, 2026-07-10)

- Catalog and search use the same `/family/[familyId]` route. The prior AI
  metadata mismatch was a lossy catalog adapter plus a stale 30-day detail
  snapshot: search returned enrichment directly, while the direct-detail
  adapter dropped `voice`, `pairingHints`, `confidence`, and `enrichedAt`.
  `FamilyEnrichment` is now a validated, user-facing detail contract and
  `FamilyInsights` renders every populated field without exposing model/prompt
  internals.
- Detail reads remain owner-scoped in IndexedDB and memory. A cached full
  detail or rich search preview renders first, then a deduplicated live request
  refreshes it without replacing visible content with a loader. Canonical and
  legacy route aliases are persisted together. On a 404, a bounded scan of the
  24-record detail LRU also clears pre-registry snapshots by matching both the
  bare slug and canonical `<uid>__<slug>` identity for that account.
- The root `AppFrame` owns the persistent navigation chrome. Workspace routes
  compose their content into that frame, while `UploadCenterModal` stays behind
  an interaction-bound `next/dynamic` overlay. `npm run verify:upload-overlay`
  checks fresh production manifests for both initial-bundle leakage and a
  missing loadable registration.
- Deliberate architectural boundary: private Firebase-authenticated records
  remain in account-scoped client caches. Vercel Data Cache and Next Cache
  Components are not enabled until Seriph has server-verifiable session auth.
