# Seriph — Search & Agent Access

> How fonts are *found* — by humans and by agents. Builds on the embedding and
> store choices in [models-and-stack.md](./models-and-stack.md) and the pipeline
> in [architecture.md](./architecture.md).

## The retrieval model

Seriph supports three overlapping ways to find a font. They share one index.

1. **Structured / exact** — name, foundry, format, weight, width, variable axes,
   script/character coverage, OpenType features. Deterministic filters over
   Firestore fields (and the existing `fuse.js` client search for fuzzy name
   matching). This is for "show me Helvetica" and "fonts that cover Devanagari."

2. **Semantic / vibe** — "a warm editorial serif," "something with 90s ski-poster
   energy," "a friendly geometric sans for a kids' app." This is vector search:
   embed the query, KNN against the font vectors, return ranked matches. Because
   the vectors are **multimodal**, a text query retrieves fonts by their actual
   rendered appearance, not just by tags.

3. **Visual similarity** — "more fonts like this one." Query with a font's own
   image embedding to find its nearest neighbors.

### Hybrid + re-rank

Real queries mix intent. The retrieval flow:

1. Parse the query into structured filters + a semantic part.
2. Pre-filter the collection by the structured part (this also keeps Firestore's
   brute-force KNN fast).
3. KNN on the semantic part over the filtered set.
4. Optionally re-rank / explain with a model (give the user *why* a font matches —
   the feature designers value most, à la Monotype AI Search).

Weight image-embedding vs text-embedding similarity independently; "looks like"
leans on the image vector, "feels like / for X use-case" leans on the text vector.

## Interactive search architecture

The UI search contract is split into separate lanes:

1. **Typeahead / preview** — the top nav search is an ephemeral preview surface.
   It uses the cached compact owner index, prepared normalized tokens, and live
   font-name previews. It must not continuously drive the full `/search` route.
   Enter or the commit row routes to the full workspace.
2. **Committed workspace** — `/search` owns committed query and filter state.
   Its URL carries `q`, `classification`, `mood`, `styles`, and `variable`
   params. The page can search by text, browse with filters, and show semantic
   refinement status.
3. **Retrieval lanes** — local lexical/fuzzy matching gives instant feedback;
   the Cloud Function runs hybrid text/mood/use-case/exact-token retrieval and
   returns richer semantic candidates. Client filtering is defense in depth; the
   backend filter contract also accepts classification, mood, style-range, and
   variable/static facets.
4. **Responsiveness budget** — keystrokes are urgent UI work. Ranking, semantic
   fetches, and result-grid rendering must be deferred, debounced, cached, or
   precomputed so typing does not create long tasks.
5. **Availability boundary** — the local compact index owns the first usable
   result render. Semantic search is a refinement lane; its errors must not
   blank the page when local results can render. The search Cloud Function must
   declare explicit memory, timeout, concurrency, and max-instance limits rather
   than relying on the default 256 MiB container.

Do not "fix" search latency by weakening relevance. Serious search systems use
write-time indexes, typeahead indexes, retrieval fan-out, ranking/fusion, facets,
and UI scheduling as separate responsibilities.

## RAG, where it helps

Pure retrieval answers "which fonts." RAG answers "which fonts *and why, and what
pairs with them*" — retrieve candidate fonts + their enrichment, then let a model
reason over that context to produce pairings, rationale, and usage guidance. The
font docs (enriched descriptions, classification, mood, pairing hints) are the
retrieval corpus. Keep retrieved context tight and cite the specific fonts.

## Agent access (the future wedge)

The long-term goal (see [product.md](./product.md)): the agents in *other* products
I build should query Seriph as their typographic backend.

**Plan: expose Seriph's retrieval layer as an MCP server.**

- An MCP server publishes a small set of tools over the same retrieval layer, e.g.
  `search_fonts(query, filters)`, `find_similar(fontId)`, `get_pairings(fontId)`,
  `get_font_asset(fontId)` (returns the stable download/CDN URL).
- Any agent framework can connect without knowing Firestore or the embedding
  details — it asks "what tools exist," calls one with parameters, and the server
  handles vectorization, filtering, re-ranking, and formatting.
- This is the 2026 pattern: **RAG for semantic retrieval, MCP for standardized,
  permission-scoped access.** Agents *pull* the fonts they need instead of us
  stuffing a catalog into a prompt.
- Scope tools read-only for external agents; the asset tool returns the same
  copy/download URL a human gets, so "find it" and "use it" are one step.

This is explicitly a **later phase** — the human-facing library and the
ingestion/enrichment/search core come first. But the data model and retrieval API
should be designed so the MCP layer is a thin wrapper, not a rebuild.

## Build-time decisions still open

- **Firestore-native vector search vs. the existing Vertex File Search path.**
  Default lean is Firestore-native for simplicity at our scale; the current
  `searchOrchestrator` / `indexFontsToFileSearch` implementation should be measured
  against it before we commit, then one of them retired.
- **Per-font vs per-family vectors.** Fine-grained retrieval (a specific weight's
  vibe) wants per-font vectors; browsing wants a family-level cover vector. Likely
  both, with family as an aggregate.
- **Re-rank model & "explain the match" UX** — which model, and how much to surface.
