copilot-instructions.md<project_spec>
  <!-- ─────────────── CORE ─────────────── -->
  <core_concepts>
    <product_name>Typeface Vault</product_name>
    <mission>Turn a designer’s chaotic font folder into a private, AI-assisted library—grouped by family, vibe-tagged, searchable, and downloadable.</mission>
    <problem_solved>Individual font files lose context; Vault stores them by family, adds rich tags, previews every style, and lets the user chat with the collection.</problem_solved>
    <primary_user>Single designer (owner) authenticated via Supabase Auth.</primary_user>
  </core_concepts>

  <!-- ─────────────── FEATURES ─────────────── -->
  <features>
    <mvp>
      • Drag-drop / batch upload font files → Vercel-S3 presigned PUT.
      • Ingest pipeline: parse family & style, AI classify, AI vibe-tag.
      • Library grid shows one **family** card (à la Fontshare).
      • Family page lists all styles; variable sliders where applicable.
      • Magic filters: combine formal tags, vibe tags, free text.
      • Preference model updates **instantly** on every upload / favourite.
      • **Auto-suggested vibe tags** ranked by preference score 🆕
      • Multi-select (styles or whole family) → zip download.
      • Tag editor UI: add, delete, rename vibe tags.
      • Bulk retag queue (LLM) with SSE progress.
    </mvp>

    <advanced>
      • Persona generator (font bio + mock copy).
      • Pairing recommender (embeddings ＋ preferences).
      • Offline JSON manifest export (Figma plugin ready).
    </advanced>

    <admin>
      • Usage dashboard (storage, OpenRouter spend).
      • OpenRouter routing rule editor.
      • Manual metadata override (family or style).
    </admin>
  </features>

  <!-- ─────────────── USER FLOWS ─────────────── -->
  <user_flows>
    <flow role="designer">
      1 Sign in → JWT cookie.
      2 Upload fonts → Vercel-S3 PUT.
      3 S3 event → `/api/ingest` parses & tags → Supabase rows + embeddings.
      4 Realtime push `ingest_complete` → library grid updates.
      5 Designer clicks a family → page with styles & sliders.
      6 Magic filter bar shows **Top 10 vibe tags ranked by preference score** 🆕
      7 Tag editor: adjust vibe tags (changes emit `tagUpdated` event).
      8 Bulk actions: select families/styles → “Download ZIP” or “Retag”.
      9 Chat query → `/api/chat` → pgvector ＋ OpenRouter → streamed answer.
    </flow>
  </user_flows>

  <!-- ─────────────── UI / UX ─────────────── -->
  <ui_decisions>
    • Next.js 15 App Router, React 19 RSC.
    • Tailwind 4 ＋ shadcn/ui.
    • Family card: sample word, style-count badge, favourite star.
    • Family page: style table, variable sliders, live glyph preview canvas.
    • Magic filter bar: pills for top vibe suggestions (auto-ranked) 🆕
    • Tag editor side-panel: dual lists (formal / vibe), combobox add, trash delete.
    • Bulk bar fixed bottom.
    • Dark/light themes; keyboard-navigable pills.
  </ui_decisions>

  <!-- ─────────────── TECH STACK ─────────────── -->
  <tech_stack>
    <frontend>Next.js 15, React 19, TypeScript, Tailwind 4</frontend>
    <backend>Vercel Serverless & Edge Functions, Supabase Postgres 16, pgvector 0.8</backend>
    <storage>Vercel-managed S3 bucket binding (`TYPEFACE_VAULT_S3`)</storage>
    <ai_rag>OpenRouter (GPT-4o default, Claude fallback) ＋ pgvector hybrid search</ai_rag>
    <realtime>Supabase Realtime channels</realtime>
    <devops>pnpm, Turborepo, ESLint, Prettier</devops>
  </tech_stack>

  <!-- ─────────────── OPENROUTER / AI ─────────────── -->
  <gen_ai_apis>
    <openrouter
      endpoint="https://openrouter.ai/api/v1/chat/completions"
      headers="Authorization, HTTP-Referer, X-Title"
      routing="default:openai/gpt-4o; fallback:anthropic/claude-3-sonnet"
      prompt_caching="true"
      strategy="latency+cost"/>
    <embedding model="openai/text-embedding-3-small" via="openrouter"/>
  </gen_ai_apis>

  <!-- ─────────────── LIBRARIES ─────────────── -->
  <libraries_and_sdks>
    opentype.js · @openrouter/openrouter-js · @supabase/supabase-js 3
    aws-sdk v3 (S3 client via Vercel binding)
    zod · tRPC v12 · adm-zip · pgvector-node · zustand
    jest · testing-library/react · playwright
  </libraries_and_sdks>

  <!-- ─────────────── AI TAGGING PIPELINE ─────────────── -->
  <ai_tagging_pipeline>
    <step order="1">Parse font (opentype.js) → family, style, axes.</step>
    <step order="2">Render preview PNGs.</step>
    <step order="3">JSON payload → OpenRouter GPT-4o (strict schema).</step>
    <step order="4">Validate via zod; Claude fallback.</step>
    <step order="5">Persist formal_tags, vibe_tags, summary.</step>
    <step order="6">Generate embeddings for vibe_tags + summary.</step>
    <step order="7">Emit <event>TagsCreated</event> → preference engine updates tag rankings 🆕</step>
  </ai_tagging_pipeline>

  <!-- ─────────────── DATABASE SCHEMA ─────────────── -->
  <database>
    <table name="families">id UUID PK, user_id, name, slug, summary, preview_url, created_at</table>
    <table name="styles">id UUID PK, family_id FK, style_name, weight, is_variable BOOL, axes JSONB, license, file_url, created_at</table>
    <table name="formal_tags">id PK, tag TEXT UNIQUE</table>
    <table name="vibe_tags">id PK, tag TEXT UNIQUE, embedding VECTOR(1536)</table>
    <table name="family_formal_tags">family_id FK, tag_id FK</table>
    <table name="family_vibe_tags">family_id FK, tag_id FK</table>
    <table name="preferences">user_id, family_id, score FLOAT, PRIMARY KEY(user_id,family_id)</table>
    <table name="tag_rankings">user_id, tag_id, weight FLOAT, PRIMARY KEY(user_id,tag_id) 🆕</table>
  </database>

  <!-- ─────────────── SOFTWARE ARCHITECTURE ─────────────── -->
  <code_architecture>
    <pattern>Hexagonal / Ports-and-Adapters inside Turborepo.</pattern>

    <backend>
      <domains>family, style, tag, preference, ranking</domains>
      <services>
        ingestService, tagService, preferenceService, rankingService 🆕, searchService,
        zipService, retagQueueService
      </services>
      <adapters>
        s3Adapter (Vercel binding), aiAdapter (OpenRouter), dbAdapter
      </adapters>
      <workflow>
        • ingestService emits TagsCreated → rankingService recalculates <tag_rankings>
        • preferenceService listens to Upload, Favourite, TagEdit events → increments
          preference score & ranking weights → broadcasts TagRankingsUpdated to FE.
      </workflow>
    </backend>

    <frontend>
      <state>
        selectionStore, tagEditorStore, preferenceContext, rankingStore 🆕
      </state>
      <rsc>Server Actions fetch families + rankings.</rsc>
      <components>
        FamilyCard, StyleRow, TagPill, TagSuggestionBar 🆕, TagEditorPanel,
        BulkBar, SliderPreview, ChatDock
      </components>
    </frontend>

    <extensibility>
      Swap AI model via env var in aiAdapter.
      Add new tag type: create table & pill variant; domain unchanged.
      Ranking algorithm tweaks live in rankingService; UI consumes via API.
    </extensibility>
  </code_architecture>

  <!-- ─────────────── DEPLOYMENT ─────────────── -->
  <deployment_plan>
    Vercel (Preview → Staging → Prod); Vercel S3 binding for fonts & zips.
    Supabase integration via Vercel add-on; ENV (`SUPABASE_*`).
    Playwright run on every preview.
    Nightly Vercel Cron deletes temp zips > 24 h.
    pino → Logflare, Sentry FE/BE, Vercel Analytics.
  </deployment_plan>

  <!-- ─────────────── TESTING ─────────────── -->
  <testing_strategy>
    unit: jest (adapters, rankingService).
    component: RTL for TagSuggestionBar, TagEditor.
    integration: Supabase Testcontainers, MinIO (S3 mock).
    e2e: Playwright—upload → tag suggestions update → edit tag → search → download zip.
    golden prompts: snapshot tag JSON to guard regressions.
  </testing_strategy>

  <!-- ─────────────── SECURITY ─────────────── -->
  <security_considerations>
    Supabase RLS (rows iso by `user_id`).
    Vercel S3 presigned URLs expire 5 min.
    Rate-limit `/api/chat` 60 req/min (Vercel KV).
    SameSite Lax cookies; robust CSRF.
    Secrets via Vercel Envs; quarterly rotation.
    Local embeddings; zero external vector DB.
    Zip streaming uses Node streams, mem < 128 MB.
  </security_considerations>
</project_spec>
