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

**Seriph** turns that pile into a library you can browse, search, and use.

Live: [seriph.naw.al](https://seriph.naw.al) · Font CDN: `https://seriph.web.app`

---

## What you can do

| You | It |
| --- | --- |
| Upload `.otf`, `.ttf`, `.woff2`, or a zip | Families group automatically; specimens show up right away |
| Browse the shelf | Covers, A–Z filter, mood/voice chips |
| Open a family | Test text, weights, variable axes, download or copy CSS |
| Search | By name, or by how a face *feels* |

---

## Stack

```
  browser ──► Next.js ──► Firebase Auth / Firestore / Storage
                 │
                 ▼
          Cloud Functions
          parse · group · convert · analyse · search index
                 │
                 ▼
          Hosting: /s  /d  /css2
```

Next.js (App Router), React 19, TypeScript, Tailwind 4, Framer Motion, Vercel.  
Firebase Auth, Firestore, Storage. Gemini / Vertex for analysis. Node 22.

---

## Run locally

```bash
# Node 22 (see .nvmrc)
npm install
cp .env.example .env.local
npm run dev                  # http://localhost:3000
```

| Env | What |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_*` | Client Firebase config |
| `FIREBASE_ADMIN_*`, `FIREBASE_STORAGE_BUCKET` | Server admin access |
| `UPLOAD_SECRET_TOKEN` | Optional local upload bypass |
| Vertex project / location | Used by Cloud Functions |

Keep secrets out of git.

### Functions

```bash
cd functions && npm install && npm run build
firebase emulators:start --only functions,firestore,storage   # optional
```

Deploy notes: [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

---

## Repo

| Path | What |
| --- | --- |
| `app/` | Routes and API |
| `components/` | UI |
| `lib/` | Client and server helpers |
| `functions/` | Upload pipeline and CDN handlers |
| `models/` | Shared types |

---

## Contributing

PR with green CI. New env vars go in `.env.example`. Functions changes keep `functions/package.json` honest.

---

```
     Aa   Bb   Cc   Dd   Ee   …
     the shelf is waiting.
```

**Seriph** — your fonts, visible again.
