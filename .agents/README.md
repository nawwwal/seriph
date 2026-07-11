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
> The type is the product.

---

## What it feels like

| You do | Seriph does |
| --- | --- |
| Drop a zip of `.otf` / `.ttf` / `.woff2` | Parses, groups families, serves specimens **before** AI finishes thinking |
| Scroll a shelf of covers | A–Z rail, voice filters, infinite grid |
| Open a family | Play with axes, test copy, copy CSS / download |
| Ask for *warm editorial* | Hybrid search: name, semantics, and vision |

Live: [seriph.naw.al](https://seriph.naw.al) · Font CDN: `https://seriph.web.app`

---

## Stack

```
  browser ──► Next.js (App Router) ──► Firebase Auth / Firestore / Storage
                    │
                    ▼
           Cloud Functions (nodejs22)
           parse · canonicalize · woff2 · Vertex enrich · vectors
                    │
                    ▼
           Hosting routes: /s  /d  /css2
```

- **Web:** React 19, TypeScript, Tailwind 4, Framer Motion, Vercel  
- **Data:** Auth, Firestore (vector search), Storage  
- **AI:** Gemini / Vertex for multimodal enrichment and embeddings  

---

## Boot it

```bash
# Node 22 (see .nvmrc)
npm install
cp .env.example .env.local   # then fill the blanks
npm run dev                  # http://localhost:3000
```

### Environment

| Kind | Examples |
| --- | --- |
| Client Firebase | `NEXT_PUBLIC_FIREBASE_*` |
| Admin / bucket | `FIREBASE_ADMIN_*`, `FIREBASE_STORAGE_BUCKET` |
| Optional | `UPLOAD_SECRET_TOKEN` (dev), Vertex project/location for functions |

Do not commit secrets. Production values live on Vercel, Firebase, and GitHub Actions.

### Functions

```bash
cd functions && npm install && npm run build
# optional:
firebase emulators:start --only functions,firestore,storage
```

Deploy and CDN setup: [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## Quality

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Source files stay under **100 non-empty lines** each (`npm run lint:lines`).

---

## Layout

| Path | Role |
| --- | --- |
| `app/` | Routes and API |
| `components/` | UI |
| `lib/` | Auth, hooks, cache, search, server |
| `functions/` | Ingestion, enrichment, CDN handlers |
| `models/` | Shared TypeScript contracts |

---

## Contributing

- Open a PR with green CI.  
- Document new env vars in `.env.example`.  
- Keep `functions/package.json` in sync when Functions change.

---

```
     Aa   Bb   Cc   Dd   Ee   …
     the shelf is waiting.
```

**Seriph** — your fonts, visible again.
