# Seriph — Models & Stack

> Research-backed decisions for the AI layer, as of **mid-2026**. Models are
> versioned and move fast — treat specific model IDs as defaults to be confirmed
> at build time and kept in Remote Config, never hardcoded. Architecture context:
> [architecture.md](./architecture.md).

## Guiding stance

- **Google-ecosystem-first, but not Google-only.** The project already runs on
  Firebase/Firestore/Vertex, and — importantly — Google currently has the
  strongest *multimodal* story for exactly our problem (seeing type + multimodal
  embeddings + vector search co-located with our data). So Google is the default,
  and it happens to also be the best technical fit today. Alternatives are listed
  per layer in case a component is outgrown.
- **Pick by the job, not by brand loyalty.** Each layer below has a recommended
  default and a "switch if" condition.

## Layer 1 — Multimodal analysis (seeing & describing a font)

**Default: Gemini 3.x (Pro for quality, Flash for cost), structured JSON output.**

- Why: Google leads multimodal/vision benchmarks (largest margins in
  vision/video understanding), and this is a vision-first task — the model looks
  at a rendered specimen and describes classification, mood, voice, use-cases, and
  pairing hints. Native structured-output support gives us clean enrichment JSON.
- Switch if: we want maximum reasoning/writing quality on the *descriptions* —
  **Claude Opus 4.8** sits at the top of human-preference rankings and is a strong
  alternative for the describe/tag step (can be mixed: Gemini sees, Claude writes).
- Cost lever: start on a Flash-tier model for the bulk pass; reserve Pro/Opus for
  low-confidence re-analysis.

## Layer 2 — Embeddings (the core of semantic search)

**Default: Gemini Embedding 2 — natively multimodal (text + image in one space).**

- Why this is the architectural unlock: Gemini Embedding 2 (released March 2026)
  is the first natively-multimodal embedding model — text, images, video, audio
  into a *single* embedding space. That means we can embed the **rendered specimen
  image** and the **enriched text description** into the same space, and a plain
  text query ("warm editorial serif") can retrieve fonts by their actual
  *appearance*, not just their tags. This is the modern version of what
  research systems like FontCLIP and Impression-CLIP demonstrated — but as a
  managed API.
- The Gemini Embedding text line also tops the public MTEB leaderboard, so the
  text side is best-in-class too.
- Switch if:
  - **Domain-specialized retrieval** matters more than multimodal — **Voyage
    (voyage-3-large / v4)** leads on domain-specific text retrieval.
  - **Multilingual at scale** — **Cohere embed-v4**.
  - **Open-weight / self-host** — **BGE-M3, Jina v5, Qwen3-Embedding** now match
    commercial APIs on MTEB.
- Note: keep image-embedding and text-embedding as *separate stored vectors* so we
  can weight them independently at query time.

## Layer 3 — Vector store & search

**Default: Firestore native vector search (`FieldValue.vector()` + KNN).**

- Why: our data already lives in Firestore. Native vector search means **no second
  datastore, no sync** — store the embedding on the same doc as the font and run
  KNN with metadata pre-filtering (e.g. restrict to serif, to an owner, to scripts
  containing Cyrillic) before the nearest-neighbor scan.
- The catch: Firestore KNN is **brute-force O(n)** — great up to ~10–20k
  embeddings, then it slows. For a *personal font collection* (hundreds to low
  thousands of faces) this is comfortably the right call, and pre-filtering extends
  the runway.
- Switch if: the library grows past tens of thousands of vectors or needs
  sub-millisecond search at scale — **Vertex AI Vector Search (ScaNN)** searches
  billions in milliseconds and is the natural Google-ecosystem scale path.
- Also available: the **Firebase "Vector Search with Firestore" extension**
  (Genkit-based) auto-embeds on document write — worth evaluating to remove
  glue code, vs. embedding explicitly in our own function.

## Layer 4 — Hybrid retrieval

Semantic vector search alone is wrong for exact lookups ("show me Helvetica",
"fonts from this foundry"). Combine:

- **Vector (semantic):** mood/vibe/visual-similarity queries.
- **Keyword / structured:** exact name, foundry, format, axis, script filters —
  via Firestore queries and/or the existing lightweight client search (`fuse.js`).
- Merge + re-rank. Details in [search-and-agents.md](./search-and-agents.md).

## Layer 5 — Specimen rendering

Needed so models and embeddings can *see* the font. Server-side render of a
representative pangram + glyph grid to image(s). Implementation (headless browser,
canvas, or satori-style SVG→PNG) is a build-time decision; the requirement is a
deterministic, repeatable specimen image per font/weight.

## Cross-cutting

- **Config:** every model name, threshold, and flag stays in **Remote Config**
  ([deployment.md](deployment.md)).
- **Versioning:** stamp each enriched doc with model id + prompt/embedding version
  so we can re-embed deterministically when models improve.
- **Cost & safety:** concurrency limits, retries, and per-run `metrics_ai` already
  exist — keep them. Budget alerts on Vertex AI per [deployment.md](deployment.md).

## References (mid-2026)

- Gemini Embedding 2 (multimodal): https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-embedding-2/
- Firestore vector search: https://firebase.google.com/docs/firestore/vector-search
- Firestore vs Vertex AI Vector Search (brute-force KNN vs ScaNN at scale):
  https://discuss.google.dev/t/vertex-ai-vector-search-vs-firestore-vectore-search/168034
- Firebase Vector Search extension: https://extensions.dev/extensions/googlecloud/firestore-vector-search
- Embedding leaderboard context (Gemini #1 MTEB, Voyage/Cohere niches):
  https://tokenmix.ai/blog/text-embedding-models-comparison
- LLM landscape (Gemini 3.x multimodal lead, Opus 4.8 human-preference):
  https://www.vellum.ai/llm-leaderboard
- Prior art — semantic/visual font retrieval: FontCLIP (https://arxiv.org/html/2403.06453v1),
  Impression-CLIP (https://arxiv.org/pdf/2402.16350), Monotype AI Search.
