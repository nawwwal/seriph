# Seriph

Seriph turns a scattered "attic" of font files into a **visual, semantically
searchable library** — for a human to rediscover and use their own fonts, and
for AI agents to query type by mood and intent in a future phase.

This file is the **router**. The durable project context lives in this `.agents/`
directory. Read the relevant doc before changing its area.

## Context Map

| Doc | Read it when you need... |
| --- | --- |
| [product.md](product.md) | Why Seriph exists, who it is for, product principles, what not to change, and product-level done criteria. |
| [architecture.md](architecture.md) | The store-first ingestion model, async enrichment, the target pipeline, data model, and what was kept or retired. |
| [models-and-stack.md](models-and-stack.md) | Model and infrastructure choices: multimodal analysis, embeddings, Firestore vector search, and alternatives. |
| [search-and-agents.md](search-and-agents.md) | Hybrid/semantic/visual search, RAG, and future MCP access for agents. |
| [frontend-ux.md](frontend-ux.md) | Front-end surface map, the catalogue auth gate, theming/tokens (and how to add a theme), inline nav search, variable-font detection, and wired interactions. Read before any UI change. |
| [ingestion-at-scale.md](ingestion-at-scale.md) | Folder/zip/nested ingestion (intake → expandArchive → unprocessed), the two-lane upload/analysis state machine, and the global Upload Center. Read before upload-journey, ingest-status, or Storage-trigger work. |
| [implementation-status.md](implementation-status.md) | As-built and live status: deployed functions, schema, decisions, verification, and deferred follow-ups. Start here for current state. |
| [deployment.md](deployment.md) | Deployment commands, Remote Config, IAM, troubleshooting, monitoring, and production checklist. |
| [roadmap.md](roadmap.md) | Short orientation and phase order. Plane is canonical for execution sequencing when configured. |
| [README.md](README.md) | Human-facing repo summary, local setup, commands, and contributor notes. |
| [pipeline-recovery-plan.md](pipeline-recovery-plan.md) | Historical recovery plan from the earlier repo/toolchain restoration effort. |
| [skills/](skills/) | Project-local Firebase skills and references. |

## Operational Quick Facts

- **Stack:** Next.js App Router, React 19, TypeScript, Tailwind 4 on Vercel;
  Firebase Auth, Firestore, Storage; Cloud Functions gen2 on nodejs22 in
  `asia-southeast1`; Firebase Hosting CDN routes for `/s`, `/d`, and `/css2`;
  Vertex AI / Gemini for AI enrichment and embeddings.
- **GCP project:** `seriph` (#277527180126).
- **Live app:** Vercel production aliases include `https://seriph.naw.al`.
- **Font CDN:** `https://seriph.web.app` serves `/s/**`, `/d/**`, and `/css2`.
- **Deployed functions:** `processUploadedFontStorage`, `enrichFontOnReady`,
  `searchFontsHttp`, `css2`, and `serveFont`.
- **Search backend URL:** `https://asia-southeast1-seriph.cloudfunctions.net/searchFontsHttp`.
- **Remote Config:** all AI/config flags and model names belong there. Do not
  hardcode model names or rollout flags.

## How To Work Here

1. Preserve the existing front-end feel. It is the fixed point.
2. Keep a font instantly viewable and downloadable; never block the core loop on AI.
3. Anything new and retrievable must land in the search/embedding layer, not only storage.
4. Read [implementation-status.md](implementation-status.md) before deployment,
   migration, search, or pipeline work.
5. Use Plane as the canonical execution roadmap when configured; use this
   `.agents/` directory for product, architecture, and operational context.

## Quality Gates

- Web: `npm run typecheck`, `npm run lint:web`, `npm test`, `npm run build`
- Functions: `npm run build --prefix functions`, `npm run lint:functions`,
  `npm test --prefix functions`

## Guardrails

- ESLint is intentionally pinned to 9.x.
- `firebase-admin` is intentionally pinned to 13.x inside `functions/`.
- The vector index dimension is 1536; if `embedding_dimensions` changes, recreate
  the Firestore vector indexes to match.
- Existing old-schema fonts still require migration or re-ingest.
