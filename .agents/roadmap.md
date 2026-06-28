# Seriph — Roadmap (orientation only)

> Deliberately small. This file orients a reader; it is **not** a second planning
> system. If/when a Plane project exists, Plane is the canonical roadmap and this
> file just points to it.

## Where the product is becoming

Seriph is moving from a *font upload + legacy enrichment pipeline* toward a
**visual, semantically-searchable font library** that both a human and AI agents
can query by mood and intent. The front-end stays; the AI/search core is being
modernized around multimodal models (see [architecture.md](./architecture.md),
[models-and-stack.md](./models-and-stack.md)).

## Rough phase sequence (leverage order, not a commitment)

Status as of 2026-06-28 — see [implementation-status.md](./implementation-status.md)
for the full as-built record.

1. **Foundation / cleanup.** ✅ Done — deps current, gates green, legacy stages
   identified and removed.
2. **Ingestion contract.** ✅ Live — store-first ingestion: parse
   → canonicalize (GF model) → woff2 → public bucket → family doc (`ready`).
3. **Modern enrichment.** ✅ Live — specimen render → single
   multimodal pass → **text** embedding (image embedding deferred). Legacy chain retired.
4. **Semantic search.** ✅ Live — Firestore-native vector search +
   structured filters; search UI wired. Vertex File Search retired.
5. **Agent access (MCP).** ⏳ Not started — next phase. See
   [search-and-agents.md](./search-and-agents.md).

**Remaining product gap after launch:** migrate/re-ingest any existing old-schema
fonts. Details and deferred follow-ups are in
[implementation-status.md](./implementation-status.md).

## Canonical planning

- **Plane** (if configured): roadmap phases, milestones, work items, dependencies.
- **This repo's `.agents/`**: product thesis, architecture, and quality bars.
- Keep them from disagreeing; when they do, Plane wins on *sequencing*, `.agents/`
  wins on *product/architecture intent*.
