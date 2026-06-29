# Frontend UX & Surfaces

How the web app is structured, themed, and gated. Read this before touching any
front-end surface. The existing editorial feel is the fixed point.

## Surface map

| Route | File | Purpose |
| --- | --- | --- |
| `/` (logged out) | `components/home/LandingPage.tsx` | Marketing landing: hero wordmark, tagline, live specimen showcase, value props, email/password sign-in CTA. No catalogue, no Firestore reads. |
| `/login` | `app/login/page.tsx` | Email/password auth form with sign-in, create-account, and password-reset modes. Redirects signed-in users home. |
| `/` (logged in) | `app/page.tsx` → `WelcomeState` / `ShelfState` | The shelf/catalogue. `WelcomeState` when empty, `ShelfState` grid otherwise. |
| `/import` | `app/(main)/import/page.tsx` | Upload journey. Hard auth gate. Consumes pending fonts from `utils/pendingFonts`, posts to `/api/upload`. |
| `/search` | `app/(main)/search/page.tsx` | Semantic search results. Auth-gated. Reads `?q=` and auto-runs (driven by the nav search field). |
| `/family/[familyId]` | `app/(main)/family/[familyId]/page.tsx` | Family detail: specimen, use-font panel, styles, type tester, character set. Auth-gated. |

## Auth gate model (catalogue is private)

The catalogue and everything behind it are only shown after Firebase email/password sign-in.

- `app/page.tsx`: while `authLoading` show spinner; if `!user` return
  `<LandingPage />`; `loadFamilies()` early-returns when `!user` so no Firestore
  read fires logged out.
- `/login` handles sign-in, account creation, and Firebase password reset email.
- `/search` and `/family/[familyId]` each render a sign-in prompt (link home)
  when `!user`, and skip their fetches.
- Public CDN routes (`/s`, `/d`, `/css2`) and `/api/share` stay public on purpose.

## NavBar (`components/layout/NavBar.tsx`)

- Logged out: brand wordmark + `ThemeSwitcher` + Sign in link to `/login`.
- Logged in: Shelf + Import links, an **inline search field** (replaced the old
  Search nav link), profile menu, theme switcher.
- The inline search submits to `/search?q=...`. It syncs its value from the URL
  via a `window.location.search` read (NOT `useSearchParams`) to avoid forcing a
  Suspense boundary on every page that renders the NavBar. The `/search` page
  itself uses `useSearchParams` inside a `<Suspense>` wrapper.

## Theming

- Tokens live in `styles/themes.css` as `[data-theme="..."]` blocks; switched via
  `components/theme/ThemeProvider.tsx` (writes `data-theme` on `<html>`,
  persists to localStorage) and `ThemeSwitcher.tsx`.
- Four themes: `ink` (default), `noir`, `sunset`, `ocean`.
- Core tokens: `--paper`, `--ink`, `--accent`, `--muted`, `--surface`, `--shadow`,
  `--focus`. Plus semantic status tokens added for theme-aware states:
  `--success`, `--danger`, `--warning`, `--info`, `--surface-muted`, `--on-surface`.
- **Rule:** never hardcode Tailwind palette colors (`blue-500`, `red-600`,
  `bg-white`, `text-gray-*`). Use the CSS-var tokens, e.g.
  `text-[var(--danger)]`, `bg-[var(--surface)]`, or
  `bg-[color-mix(in_srgb,var(--warning)_12%,transparent)]` for tints. Tailwind
  arbitrary values can't contain spaces — use underscores inside `color-mix`.
- **Adding a theme:** add a `[data-theme="name"]` block in `styles/themes.css`
  with the full token set, then add the option to `ThemeSwitcher.tsx`. ~12 lines.

## Variable-font detection

- Root cause fixed: fontkit always exposes `font.variationAxes` (often `{}`,
  truthy), so the server parser marked every font variable. Fix in
  `functions/src/parser/fontParser.ts`: require
  `Object.keys(font.variationAxes).length > 0`. The client worker
  (`lib/workers/font-parser.worker.ts`, checks `fvar.axes`) was already correct.
- UI surfaces the flag: a "Variable" chip in `StyleCard` and a "Var" chip in
  `FamilyCover`, rendered only when `isVariable` is true.
- **Caveat:** fonts ingested before this fix keep the wrong `isVariable` flag in
  Firestore until re-ingested or migrated (matches the existing old-schema
  migration guardrail).

## Wired interactions (family detail + home)

- Test in Text → smooth-scrolls to the `<TypeTester>` section (ref).
- Add Style → hidden file input → `storePendingFonts` → `/import` (ingestion
  auto-groups by family name).
- Download → zips all family font files client-side with `jszip` (fetches each
  `metadata.downloadUrl`/`cdnUrl`).
- Share → copies the family URL to clipboard.
- Regenerate Covers (home) → bumps a `coverSeed` threaded into `FamilyCover`,
  re-picking the deterministic cover pattern. Covers are purely client-side
  (deterministic from family name); there is no server-generated cover.
- Right-click a shelf cover → context menu with Open, Select, and Delete.
  Select enters shelf selection mode; selected covers can be merged into one
  canonical family or hard-deleted after confirmation. Merge writes hidden alias
  docs and shows a short undo toast; delete is permanent.
