```
   ███████╗███████╗██████╗ ██╗██████╗ ██╗  ██╗
   ██╔════╝██╔════╝██╔══██╗██║██╔══██╗██║  ██║
   ███████╗█████╗  ██████╔╝██║██████╔╝███████║
   ╚════██║██╔══╝  ██╔══██╗██║██╔═══╝ ██╔══██║
   ███████║███████╗██║  ██║██║██║     ██║  ██║
   ╚══════╝╚══════╝╚═╝  ╚═╝╚═╝╚═╝     ╚═╝  ╚═╝
```

# The attic, finally lit.

Somewhere on your drive there is a folder named `fonts-final-v3`  
(or `Desktop/type`, or a zip you mailed yourself in 2019).

Inside: years of purchases, freebies, foundries, late-night downloads.  
Outside: silence. You cannot *see* them. So you open Google Fonts again.

**Seriph** is what happens when that attic becomes a library you can browse  
with your eyes, search by mood, and use in one click.

> Visual-first. Instantly usable. Enrichment later.  
> The type is the product. Everything else is backstage.

---

## What it feels like

| You do | Seriph does |
| --- | --- |
| Drop a zip of `.otf` / `.ttf` / `.woff2` | Parses, groups families, serves specimens **before** AI finishes thinking |
| Scroll a shelf of covers | A–Z rail, voice filters, infinite grid, no “please wait for taxonomy” |
| Open a family | Play with axes, test copy, copy CSS / download, read moods & use-cases |
| Ask for *warm editorial* | Hybrid search (name + semantics + vision embeddings, progressive) |

Two readers, one shelf:

1. **You** — rediscover what you already own.  
2. **Agents** (the long game) — query type by intent when software needs to *choose* fonts.

Live: [seriph.naw.al](https://seriph.naw.al) · Font CDN: `https://seriph.web.app`

---

## Stack, without the brochure

```
  browser ──► Next.js (App Router) ──► Firebase Auth / Firestore / Storage
                    │
                    ▼
           Cloud Functions (nodejs22)
           parse · canonicalize · woff2 · Vertex enrich · vectors
                    │
                    ▼
           Hosting routes: /s  /d  /css2   (the CDN surface)
```

- **Web:** React 19, TypeScript, Tailwind 4, Framer Motion, Vercel  
- **Data:** Auth, Firestore (incl. vector search), Storage  
- **Brain:** Gemini / Vertex for multimodal enrichment & embeddings  
- **Rule of house:** `npm run lint:lines` — **100 non-empty lines max per file**. Split by responsibility, not by golfing.

---

## Boot it

```bash
# Node 22 (see .nvmrc)
npm install
cp .env.example .env.local   # then fill the blanks
npm run dev                  # http://localhost:3000
```

### Env (the short version)

| Kind | Examples |
| --- | --- |
| Client Firebase | `NEXT_PUBLIC_FIREBASE_*` |
| Admin / bucket | `FIREBASE_ADMIN_*`, `FIREBASE_STORAGE_BUCKET` |
| Optional | `UPLOAD_SECRET_TOKEN` (dev), Vertex project/location for functions |

Secrets stay out of git. Production lives on Vercel / Firebase / Actions.

### Functions (the other package)

```bash
cd functions && npm install && npm run build
# optional:
firebase emulators:start --only functions,firestore,storage
```

Deploy / CDN / Remote Config: see [DEPLOYMENT.md](./DEPLOYMENT.md) and `.agents/deployment.md`.

---

## Prove it still works

```bash
npm run lint        # lines + web ESLint + functions
npm run typecheck
npm test
npm run build
```

CI runs the same gate. Do not “fix” a 101-line file with a comment. Split it.

---

## Map of the house

| Path | Soul |
| --- | --- |
| `app/` | Routes & API |
| `components/` | UI (shell, shelf, detail, playground, themes) |
| `lib/` | Auth, hooks, cache, search, server |
| `functions/` | Ingestion, enrichment, CDN handlers |
| `models/` | Shared TypeScript contracts |
| `.agents/` | Product, architecture, status, how agents should work |

Start agents and humans here: [`.agents/AGENTS.md`](./.agents/AGENTS.md) → [`implementation-status.md`](./.agents/implementation-status.md).

---

## Product commandments (abridged)

1. **Never block “see / download” on AI.** Enrichment is progressive.  
2. **The front-end feel is the fixed point.** Pipeline may rewrite; the chrome may not become a generic dashboard.  
3. **New retrievable truth goes in search/embeddings**, not only Storage.  
4. **Remote Config owns model names and rollout flags** — no hardcoded model lottery in source.

Full doctrine: [`.agents/product.md`](./.agents/product.md).

---

## Contributing (the boring part, still required)

- Branch, PR, green CI.  
- New env vars → `.env.example`.  
- Functions changes → keep `functions/package.json` honest.  
- Prefer small modules over clever walls of code.

---

```
     Aa   Bb   Cc   Dd   Ee   …
     the shelf is waiting.
```

**Seriph** — your fonts, visible again.
