# Seriph — Implementation Status (as-built)

> Living record of what's actually built vs. the target in
> [architecture.md](./architecture.md) / [models-and-stack.md](./models-and-stack.md).
> Last updated: 2026-06-28. Update this whenever the build state changes.

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
- `index.ts` — rewritten. Exports: `expandArchive` (intake trigger),
  `processUploadedFontStorage` (ingest trigger), `submitEnrichmentBatch` +
  `pollEnrichmentBatch` (scheduled all-batch enrichment), `searchFontsHttp`,
  `css2`, `serveFont`.
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
  — load fonts from CDN urls (fallback to the legacy proxy).
- `components/font/UseFontPanel.tsx` — copy CSS `<link>`, copy woff2 URL, download.
- `app/(main)/search/page.tsx` + nav link — semantic search UI → `/api/search`.

### Infra-as-code
- `firebase.json` — Hosting rewrites `/s/**`, `/d/**`, `/css2` → functions; CORS headers.
- `firestore.indexes.json` — `text_vec` vector indexes (single-field + `ownerId`/
  `category` composites, **dimension 1536**).
- `scripts/setup-catalog.sh` — public bucket + IAM + CORS + SA write.
- `hosting/index.html`, updated [deployment.md](deployment.md).

### Retired (deleted)
`functions/src/ai/pipeline/*` (visual/web/enriched analysis, summary,
`searchOrchestrator`, `indexFontsToFileSearch`), `ai/prompts/*`, `ai/schemas/*`,
`db/firestoreUtils.admin.ts`, `models/search.models.ts`, `tests/integration/*`,
and the old `hybridFontSearch` / `testFontPipeline` / `batchReprocessFonts` /
`createOrUpdateEnrichedPrompt` functions. Vertex File Search is no longer used.
(`/api/font/gcs` proxy is kept as a deprecated fallback.)

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
2. Functions + Firebase Hosting deployed. The old `hybridFontSearch`,
   `testFontPipeline`, `batchReprocessFonts`, and `createOrUpdateEnrichedPrompt`
   functions were removed by the cutover.
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
- `POST https://seriph.naw.al/api/search` finds `letters-home` with an embedding
  score and enrichment summary/moods.

Current RC note: `is_vertex_enabled` is already `true` in the existing `Server`
Remote Config group. New rebuilt keys such as `catalog_public_bucket`,
`analysis_model_name`, `embedding_model_name`, and `embedding_dimensions` are
currently using code defaults (`seriph-fonts`, `gemini-2.5-flash`,
`gemini-embedding-001`, `1536`) unless explicitly added.

## Ingestion + upload status + detail UI pass (2026-06-28)
- **Scalable ingestion (code-complete, needs deploy):** drop folders/zips/nested.
  Client walks the tree + resumable-uploads to `intake/**`; new `expandArchive`
  Storage trigger normalizes fonts → `unprocessed_fonts/**` and recurses zips.
  Content-hash dedup + per-batch ledger. RC key `intake_bucket_path`. **Phase 3
  (Cloud Run job for >150MB zips + Cloud Tasks backpressure) not built** —
  oversized zips are skipped + ledgered. See [ingestion-at-scale.md](./ingestion-at-scale.md).
  Deploy needs: `expandArchive` function, Storage rules for `intake/**`,
  collection-group index on `ingests.familyId`.
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

## Deferred follow-ups (none block launch)
- **Migration/reprocess** of existing fonts into the new schema (old
  `batchReprocessFonts` was removed). Existing old-schema fonts won't appear
  until re-ingested or migrated. **Also re-ingest to correct stale `isVariable`
  flags from the pre-fix parser.**
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
