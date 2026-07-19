# Frontend UX & Surfaces

How the web app is structured, themed, and gated. Read this before touching any
front-end surface. The existing editorial feel is the fixed point.

## Surface map

| Route | File | Purpose |
| --- | --- | --- |
| `/` (logged out) | `components/home/LandingPage.tsx` | Marketing landing: hero wordmark, tagline, live specimen showcase, value props, email/password sign-in CTA. No catalogue, no Firestore reads. |
| `/login` | `app/login/page.tsx` | Email/password auth form with sign-in, create-account, and password-reset modes. Redirects signed-in users home. |
| `/` (logged in) | `app/page.tsx` → `WelcomeState` / `ShelfState` | The shelf/catalogue. `WelcomeState` when empty, `ShelfState` grid otherwise. |
| `/import` | `app/(main)/import/page.tsx` | Upload journey. Hard auth gate. Consumes pending fonts from `utils/pendingFonts`, registers durable import batches, and uploads to private intake storage. |
| `/search` | `app/(main)/search/page.tsx` → `SearchWorkspace` | Full search workspace. Auth-gated. Reads committed `?q=` plus filter params and owns result refinement. |
| `/family/[familyId]` | `app/(main)/family/[familyId]/page.tsx` | Family detail: specimen, use-font panel, styles, type tester, character set. Auth-gated. |

## App frame and detail parity

- Signed-in workspaces use shared `AppShell` (logo, header search, optional
  sidebar, canvas, status strip with uploads/theme/profile). `AppFrame` only
  owns the fixed `h-screen` viewport for signed-in routes and shows `NavBar`
  for public/logged-out surfaces. Do not reintroduce a second nav shell on
  import/search/family. Logged-out routes retain document scroll; signed-in
  routes keep bounded internal scroll roots inside `AppShell`.
- Every catalog or search route resolves to the same family detail surface.
  The AI Insights section belongs above styles/tester and renders only validated
  enrichment: summary, voice, mood, best-for tags, pairing hints,
  classification, confidence, and analysis date. Never expose model IDs,
  prompt versions, or embedding metadata to this UI.
- A populated full detail remains visible during revalidation. Search can seed
  a non-persisted rich preview; lower detail content skeletonizes until the
  owner-scoped full payload arrives. Do not replace a visible specimen with a
  route loader during a refresh.
- Keep `UploadCenterModal` interaction-loaded through
  `UploadCenterOverlay`. The provider stays mounted at the root, so opening
  Uploads, progress state, and completion behavior do not depend on the route.

## Shelf loading and stats

- A catalog card represents a canonical font family, not a filename-derived
  uploaded file group. Server ingest and repair scripts must prefer OpenType
  typographic family/subfamily names (`preferredFamily`/`preferredSubfamily`)
  stored in `face.meta`; legacy family/subfamily strings are fallback data only.
  If the original font metadata says `Audacious Display Medium` belongs to
  typographic family `Audacious`, the shelf should show one Audacious family
  with `Display Medium` as a face style.
- The logged-in shelf uses `useInfiniteFamilies()` for the paginated card grid
  and `GET /api/v1/families/stats` for aggregate stats. Do not derive top-row
  Families, Styles, or Recently Added from the currently loaded page; infinite
  scroll only knows the mounted slice of the catalog.
- First-page family data and shelf stats fetch in parallel with a shared Firebase
  ID-token promise. The page can render from local cache or the first API page
  while stats arrive independently; stats are cached into the same shelf cache
  once available.
- Shelf cards keep their original grid sizing and hover behavior. `FamilyCover`
  is memoized, but do not put `content-visibility` / `contain-intrinsic-size` on
  the shelf grid wrappers: the grid uses auto rows plus `h-full`, so intrinsic
  containment can inflate card rows.
- Font/card selection surfaces use the shared `.seriph-card-hover` utility. This
  is the canonical hover from the style cards: `translateY(-4px)` plus
  `box-shadow: 0 4px 0 var(--ink)`. Do not use scale-up or tinted overlay hover
  states on catalog cards, search result cards, or style cards.
- Search result cards reuse the catalog `FamilyCover` shell. The only
  search-specific addition is the result description directly under the
  font-rendered family name inside the footer, before the Styles/classification
  row; do not move that description outside the card or add separate mood chips.
- The shelf is grouped into alphabet sections (`A`, `B`, `C`, ...) using nested
  card grids. Do not place alphabet headers directly inside the card grid; header
  rows must not participate in `auto-rows-fr` card sizing.
- Infinite scroll should feel invisible. The sentinel is a 1px hidden element
  with a large root margin; it prefetches before the user reaches the bottom and
  must not show visible "Loading more families" copy during normal scrolling.
  If the user outruns pagination, the bottom of the shelf should show a grid of
  card-shaped skeletons that match the catalog cards, not an empty gap or text
  status row.
- Loaded pages are cached as one growing shelf view. Returning from a family
  detail page should reuse the loaded page cache, preserve the inner shelf
  scroll position, and only refresh in the background.
- The shelf scroll position belongs to the nested shelf scroller, not `window`.
  Save a v2 JSON snapshot with `top`, `anchorFamilyId`, `anchorOffset`, and
  `updatedAt` in `sessionStorage`; do not support legacy pixel-only snapshots.
  Restore by family anchor first, loading more cached/API pages until the anchor
  exists, and use raw pixel fallback only when the anchor cannot be loaded.
- Family detail loading must keep the real app chrome mounted. `NavBar` stays
  visible while the detail body skeleton loads; do not swap it for a skeleton
  nav, or Shelf/search/uploads/profile/theme controls visibly flicker.
- Intent prefetch for a family route should warm the same full-detail
  `loadFamilyDetail()` cache that `/family/[familyId]` reads. Shelf/search
  summary cards also seed a lightweight owner-scoped preview cache so the family
  header, specimen, and use-font panel can paint immediately while the canonical
  detail payload hydrates the lower sections.
- Shelf preview faces are registered once into a session-level font-face sheet
  as cards near the viewport. Do not remove those preview face rules on card
  unmount, or returning from detail pages will make the catalog feel cold again.

## Auth gate model (catalogue is private)

The catalogue and everything behind it are only shown after Firebase email/password sign-in.

- `app/page.tsx`: while `authLoading` show the animated splash; if `!user` return
  `<LandingPage />`; `loadFamilies()` early-returns when `!user` so no Firestore
  read fires logged out.
- `/login` handles sign-in, account creation, and Firebase password reset email.
- `/search` and `/family/[familyId]` each render a sign-in prompt (link home)
  when `!user`, and skip their fetches.
- Public CDN routes (`/s`, `/d`, `/css2`) stay public on purpose. Import and share APIs remain Firebase-authenticated under `/api/v1/**`.

## NavBar (`components/layout/NavBar.tsx`)

- Logged out: brand wordmark + `ThemeSwitcher` + Sign in link to `/login`.
- Logged in: Shelf + Import links, an **inline search field** (replaced the old
  Search nav link), profile menu, theme switcher.
- The inline search submits to `/search?q=...`. It syncs its value from the URL
  via a `window.location.search` read (NOT `useSearchParams`) to avoid forcing a
  Suspense boundary on every page that renders the NavBar. The `/search` page
  itself uses `useSearchParams` inside a `<Suspense>` wrapper.
- The inline nav search is a preview/typeahead surface, not the full results
  page. While typing, it shows local result previews and does not mutate the
  current `/search` URL or full result grid. Enter or the preview commit row
  routes to `/search?q=...`.
- The `/search` page is the committed workspace. It has its own search field,
  filter rail, URL-addressed facets (`classification`, `mood`, `styles`,
  `variable`), local prepared-index results, and debounced semantic refinement.
  Search input must stay responsive while the result grid catches up.
- The `/search` Suspense boundary must render a stable workspace-shaped fallback,
  not `null`. Result cards should key by route identity (`slug || id`) so local
  results and semantic refinement update without remounting the same family card.
- Search filter counts must be scoped to the active query candidate set, not the
  whole library. Build them locally from the prepared search index so typing does
  not create extra Firestore/Function aggregation calls. Same-facet counts stay
  disjunctive, so selected Voice/Style/Mood controls still show what switching
  to a sibling option would produce.
- Voice filters/cards use canonical coarse buckets (`Serif`, `Sans Serif`,
  `Monospace`, etc.). If enrichment classification says something like
  "high-contrast transitional display serif", coarsen that to `Serif` before
  rendering/filtering; do not expose raw enrichment phrases as filter buckets or
  default contradictory data to `Sans Serif`.

## Theming

- Tokens live in `styles/themes.css` as `[data-theme="..."]` blocks; switched via
  `components/theme/ThemeProvider.tsx` (writes `data-theme` on `<html>`,
  persists to localStorage) and `ThemeSwitcher.tsx`.
- Core themes: `ink` (default), `noir`, `sunset`, `ocean`, plus extended
  Seriph presses and Variant-archive additions (`phosphor`…`cloister`). See
  `lib/theme/themes.ts` for the full list. Existing presses are never replaced
  when new archive palettes are added.
- Core tokens: `--paper`, `--ink`, `--accent`, `--muted`, `--surface`, `--shadow`,
  `--focus`. Plus semantic status tokens added for theme-aware states:
  `--success`, `--danger`, `--warning`, `--info`, `--surface-muted`, `--on-surface`.
- `--muted` is the ghost/track/skeleton token and must stay derived from
  `--ink` at low opacity, not from a separate palette color. Slider tracks,
  progress tracks, skeleton bars, and quiet hover fills should feel like faded
  foreground ink. Use `--control-track` for range/progress tracks; it aliases the
  muted ink-opacity token.
- `--focus` is the focus-ring token and must stay `var(--ink)`. Search inputs,
  sliders, buttons, dialogs, and any `theme-focus-ring` surface should focus in
  the active theme foreground, not in accent blues, pinks, yellows, or other
  one-off palette colors.
- Scrollbars are product chrome, not OS chrome. `styles/utilities-scrollbar.css`
  themes every scrollbar (document and nested overflow roots) with paper track,
  rule edge, and a block ink thumb with grip marks, matching the elastic slider
  family. Do not reintroduce unstyled system scrollbars.
- **Rule:** never hardcode Tailwind palette colors (`blue-500`, `red-600`,
  `bg-white`, `text-gray-*`). Use the CSS-var tokens, e.g.
  `text-[var(--danger)]`, `bg-[var(--surface)]`, or
  `bg-[color-mix(in_srgb,var(--warning)_12%,transparent)]` for tints. Tailwind
  arbitrary values can't contain spaces — use underscores inside `color-mix`.
- **Adding a theme:** add a `[data-theme="name"]` block in `styles/themes.css`
  with the full token set, then add the option to `ThemeSwitcher.tsx`. ~12 lines.
- Theme startup and previews must use the same storage contract:
  `seriph-theme:v1` first, legacy `theme` only as a fallback. Hover/focus
  previews set `data-theme` on `<html>` so both the page and the theme panel
  (which does not pin its own `data-theme`) repaint together. Swatches keep
  per-option `data-theme` so each ink well still shows its own paper/ink.

## Motion and splash

- Auth/loading splash screens use `LoadingSplash`, which composes the reusable
  `SplashWordmark`. The visible splash should be the centered Seriph wordmark
  with a left-to-right per-letter wave. Do not bring back the old spinner plus
  "Loading Seriph" text treatment for primary app loading.
- Splash motion follows the Interface Craft storyboard pattern: readable
  sequence comment in the component, data-driven repeated letters, named CSS
  timing tokens, and no scattered animation magic numbers in JSX.
- Keep splash animation CSS-only and transform-only. The letters move with
  `translate3d`, use theme `--ink`, and must include `prefers-reduced-motion`
  so reduced-motion users see a static centered wordmark.

## Base UI primitives

- Base UI is the unstyled behavior layer; Seriph owns the visual contract. Keep
  product styling in local primitives and class builders, not scattered raw
  Base UI parts at call sites.
- Current local primitive boundary:
  `components/ui/Button.tsx` wraps Base UI Button,
  `components/ui/TextInput.tsx` wraps Base UI Input,
  `components/ui/Modal.tsx` wraps Base UI Dialog, delete confirmation uses Base
  UI AlertDialog, `ThemeSwitcher.tsx` uses Base UI Select, and
  `ProfileMenu.tsx` uses Base UI Menu.
- Visual parity is mandatory when migrating controls. Preserve existing
  `rule`, `theme-focus-ring`, `theme-shadow-*`, `btn-ink`, `ink-bg`,
  radius, sizing, and theme-token classes unless the product direction
  explicitly changes.
- Do not blindly replace native browser controls when exact appearance matters.
  The Type Tester native selects, variable-font range sliders, search filter
  checkboxes, hidden file inputs, and coordinate shelf context menu are planned
  wrapper candidates, but each needs a bespoke Seriph primitive before migration
  so platform chrome, right-click positioning, and upload plumbing do not drift.

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

- Catalog/search/nav family entries seed a lightweight detail preview from the
  shelf/search card data, then prefetch the route and owner-scoped family detail
  on intent signals (pointer enter, focus, touch start, click). The detail
  loader dedupes concurrent requests and caches both canonical family ids and
  route aliases, so dev Strict Mode and merged-family slugs do not double-fetch
  the same detail payload.
- Test in Text → smooth-scrolls to the `<TypeTester>` section (ref).
- Add Style → hidden file input → `storePendingFonts` → `/import` (ingestion
  auto-groups by family name).
- Download → loads the zip helper only after the user clicks Download, then zips
  all family font files client-side with `jszip` (fetches each
  `metadata.downloadUrl`/`cdnUrl`).
- Share → copies the family URL to clipboard.
- Regenerate Covers (home) → bumps a `coverSeed` threaded into `FamilyCover`,
  re-picking the deterministic cover pattern. Covers are purely client-side
  (deterministic from family name); there is no server-generated cover.
- Right-click a shelf cover → context menu with Open, Select, and Delete.
  Select enters shelf selection mode; selected covers can be merged into one
  canonical family or hard-deleted after confirmation. Merge writes hidden alias
  docs and shows a short undo toast; delete is permanent.

## Font preview rule

- A font family name is not useful as plain UI text when the user is choosing a
  font. In search results, suggestions, shelf/catalog cards, and any future font
  picker, render the family name in that family's own face whenever a cover/preview
  face URL is available. Metadata can use system type, but the candidate font name
  itself should be a live preview, not just a label.
