# Seriph — Target Architecture

> The *how*. Product rationale is in [product.md](./product.md); concrete model
> and provider choices (with research) are in
> [models-and-stack.md](./models-and-stack.md); search/agent design is in
> [search-and-agents.md](./search-and-agents.md).
>
> **As-built:** this target is implemented and live.
> For exactly what shipped, the concrete schema, decisions, and deferred items,
> see [implementation-status.md](./implementation-status.md).

## Design tenets

1. **Store-first, enrich-async.** Ingestion makes a font *usable* immediately;
   enrichment runs in the background and only ever *adds* value.
2. **Deterministic before probabilistic.** Anything a parser can know for certain
   (names, axes, glyph coverage, features) is extracted deterministically and is
   never overwritten by a model.
3. **One strong multimodal pass over many brittle stages.** Replace the legacy
   multi-stage scaffolding with: render → see → describe → embed.
4. **Search is a first-class output, not an afterthought.** Every enrichment step
   ends by writing something the retrieval layer can use (a vector, a filterable
   field).
5. **Fail safe, switch off fast.** Every AI stage is behind a kill-switch and
   degrades to deterministic metadata.

## The pipeline (target)

```
        ┌─────────── INGESTION (synchronous, fast) ───────────┐
upload ▶ │ 1. accept file(s)  → Storage (unprocessed)         │
        │ 2. parse (fontkit/opentype) → deterministic metadata │
        │ 3. family grouping (normalize names → family doc)    │
        │ 4. write font + family docs (status: "ready")        │ ──▶ font is
        │ 5. move asset → Storage (processed), mint stable URL │     viewable +
        └──────────────────────────────────────────────────────┘     downloadable
                              │ emits event
                              ▼
        ┌──────────── ENRICHMENT (asynchronous, progressive) ─────────────┐
        │ 6. render specimen image(s) (representative text + glyph grid)   │
        │ 7. multimodal analysis (Gemini, structured output):             │
        │      classification • mood/voice • use-cases • pairing hints •   │
        │      optical size • confidence bands                            │
        │ 8. embed → vector(s):                                           │
        │      a) multimodal embedding of the specimen image              │
        │      b) text embedding of the enriched description              │
        │ 9. write vectors + enriched fields back to the font/family doc  │
        │ 10. index for vector search (Firestore FieldValue.vector / KNN) │
        └─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                     hybrid search + RAG + (future) MCP
```

### Why store-first (the upload-vs-enrich question, decided)

The open question was: do we enrich before or after storing? **Store first.**

- The core product value ("see it, grab it") must never wait on a model call.
- Enrichment is the unreliable, slow, costly part; isolating it behind an event
  boundary means a failed/slow analysis never blocks a usable font.
- It lets us re-run / improve enrichment independently (re-embed the whole library
  when a better model ships) without re-ingesting anything.

The existing code already leans this way (a Storage trigger kicks off the
pipeline). We formalize it: **ingestion and enrichment are separate, event-linked
stages**, not one synchronous call.

### Step notes

- **Parse (deterministic):** keep `fontkit` + `opentype.js` in `functions/src/parser`.
  This is ground truth: family/subfamily, PostScript name, weight/width, variable
  axes, glyph count, OpenType features, script/character coverage, format.
- **Family grouping:** normalize family names (`utils/normalize`) to a canonical
  family doc; loose files (Regular/Bold/Italic/variable) collapse into one family.
- **Render specimen:** the new, important step. To analyze and to *multimodally
  embed* a font, we render it to image(s) — a representative pangram plus a glyph
  grid — server-side. This is what lets a model and an embedding model actually
  *see* the type. (Render approach: headless/canvas/satori-style; TBD in build.)
- **Multimodal analysis:** one structured call (see models-and-stack.md) produces
  the enrichment JSON. Replaces the old visualAnalysis → webEnricher →
  enrichedAnalysis → summary chain.
- **Embed:** dual representation — the specimen *image* embedding (captures actual
  appearance) and the enriched *text* embedding (captures described intent). Both
  in one shared multimodal space so text queries can retrieve by appearance.
- **Index:** store vectors on the Firestore doc; KNN over the collection with
  metadata pre-filtering (see search-and-agents.md).

## Data model (target shape)

- `fontfamilies/{familyId}` — canonical family: name, normalizedName,
  classification, members[], aggregated tags/mood, cover specimen, owner.
- font records (per weight/style) — deterministic metadata + enrichment + vectors
  + `storagePath` / stable URL. (Current code nests fonts under the family doc;
  whether fonts become their own subcollection for per-font vector search is a
  build-time decision — per-font vectors are needed for fine-grained retrieval.)
- enrichment fields — classification, mood/voice descriptors, use-cases,
  pairing hints, confidence bands, model + prompt version (for reproducibility).
- vectors — `FieldValue.vector(...)` fields for image + text embeddings.
- caches/metrics — keep `metrics_ai`, rate-limit, and web-enrichment cache
  patterns that already exist where they still earn their place.

## What we keep from the current code

- Firebase Storage + Firestore + Cloud Functions (gen2, asia-southeast1, nodejs22).
- Deterministic parser (`functions/src/parser`).
- Remote Config kill-switches & per-run metrics (`metrics_ai`).
- Family normalization logic.
- The Next.js front-end **as-is** (design is fixed).

## What we collapse or retire

- The legacy multi-stage AI chain in `functions/src/ai/pipeline/`
  (`visualAnalysis` → `webEnricher` → `enrichedAnalysis` → summary) collapses into
  a single structured multimodal analysis + embedding step.
- Heavy web-scraping enrichment becomes optional grounding, not a core stage.
- Vertex File Search–based "hybrid font search" (`searchOrchestrator`,
  `indexFontsToFileSearch`) is re-evaluated against native Firestore vector search;
  keep whichever wins on simplicity for the collection size (see
  search-and-agents.md). Default lean: **Firestore-native vector search**.

## Deployment & environments

- Functions deploy to Firebase (gen2). Web deploys to Vercel.
- All AI config stays in Remote Config (kill-switch `is_vertex_enabled`, models,
  thresholds) per [deployment.md](deployment.md) — do not hardcode model names or flags.
- Staged rollout via Remote Config conditions remains the launch mechanism.
