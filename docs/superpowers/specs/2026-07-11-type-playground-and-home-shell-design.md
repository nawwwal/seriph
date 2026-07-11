# Seriph Home Shell, Wordmark, and Type Playground Design

## Goal

Make the signed-in home page match the approved Figma shell, adopt the supplied Seriph wordmark across primary brand surfaces, and replace the split family tester/variable controls with one compact, left-to-right typography playground.

## Product Direction

- Preserve Seriph's two-color, rule-driven visual language and existing theme tokens.
- Use the Figma frame as the home-page information architecture, not as a reason to remove working catalog behavior.
- Keep the app dense, calm, and immediately usable. Do not add explanatory cards, decorative containers, or extra loading states.
- Treat the paused local playground files in `/Users/adi/projects/seriph` as implementation progress. Port their useful behavior into the clean worktree without copying stale surrounding files.

## Theme-Aware Wordmark

The supplied `/Users/adi/Downloads/seriph logo.svg` is the canonical Seriph wordmark geometry. Store a normalized copy in `public/seriph-logo.svg` and render it through a reusable `SeriphLogo` component.

The SVG asset must not retain its fixed cream fill. The component should use the asset as a CSS mask with `background-color: currentColor`, so the wordmark inherits `var(--ink)` or the surrounding foreground color in every theme. It must preserve the original `193 / 48` aspect ratio, expose useful size classes, and provide an accessible text label when linked.

Use the component in the signed-in home header, the global navigation brand location, and the signed-out landing page. Preserve the animated splash treatment because it communicates loading state rather than acting as the primary static logo.

## Home Shell

At desktop widths, the signed-in home page follows Figma node `5:5`:

- 20px outer inset.
- One clipped shell with a 1px `var(--ink)` border and 13px radius.
- 96px header with 24px padding and a bottom rule.
- 368px left rail with a right rule and 40px horizontal / 48px vertical padding.
- Flexible catalog canvas on the right.
- 40px footer/status strip with a top rule.

The header places only the 193x48 themed wordmark on the left. It must not become a general toolbar.

The left rail begins with one `Import` action, which is the same action as Add Fonts. Beneath it, `BROWSE BY ALPHABET` uses the exact five-column A-Z grid: A-E, F-J, K-O, P-T, U-Y, then Z alone in the first cell. Each cell has equal dimensions and 1px rules; the active letter inverts foreground/background. Selecting a letter filters the already-loaded catalog by family name without navigation or a full-screen loader. `All` is a compact separate control and must not distort the A-Z grid.

The right catalog canvas keeps the real shelf: selection, pending uploads, covers, infinite loading, empty state, mutations, and scroll restoration. Remove the previous oversized hero and prose from the signed-in home. Remove cover regeneration and the nonfunctional spines/covers mode entirely. The bottom status strip contains compact server-owned stats, upload progress/count, profile access if needed, and the theme switcher. A transient upload-center control may appear in the left rail only while an upload is active; there is no permanent Uploads button.

On tablet/mobile, the shell keeps its border and radius with a smaller outer inset. The header may wrap actions beneath the logo. The alphabet rail becomes a horizontal, scrollable control above the catalog; it must not squeeze the catalog into an unusable column. The status strip may wrap to two rows while retaining rules and readable labels.

## Unified Type Playground

The family page keeps its static `AaBbCc...` specimen as a non-editable overview. Immediately after it, render one `Type Playground` before `Use this font`. Remove the old standalone `TypeTester` and `VariableFontPlayground` surfaces.

The playground contains:

- An explicitly left-to-right editable textarea. Typing `ABC` must remain `ABC`, and the caret must advance left to right regardless of browser locale.
- A style selector keyed by face ID, not subfamily text. Default to the closest upright Regular/400 face.
- Font size from 12px to 200px.
- Letter spacing with px and percent-like Figma units. Store the percent value as an em-relative value and emit valid CSS predictably instead of depending on CSS Text percentage semantics.
- Line height with Auto, percent, and px modes.
- Variable axis controls only when the selected face exposes axes. Reset each axis to its declared default.
- `Reset` and `Copy CSS` actions. Copy feedback changes briefly to `Copied` without moving the layout.

Desktop layout uses a generous editor beside or above a compact two-column controls grid. Mobile uses one column. User text, selection, scroll position, and control values must not reset during family-detail background refresh.

All range controls support pointer input, arrow keys, Shift-modified larger steps, Home, End, numeric entry, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, and meaningful `aria-valuetext`. Respect `prefers-reduced-motion`.

## Data and Component Boundaries

- `SeriphLogo` owns only themed rendering and accessible branding.
- `HomePageContent` remains the shelf controller and mutation owner.
- A home-shell component owns desktop/mobile composition and alphabet selection.
- Alphabet filtering is derived from loaded families and must not mutate the cache or server query contract.
- The playground reducer/model owns style, text, units, metrics, and axes as one serializable state.
- Presentation components receive explicit state and callbacks; they do not fetch family data.
- Existing family preview/full-detail reconciliation remains authoritative.

## Loading and Errors

Cached shelf content remains visible while refreshing. A first visit shows the existing static shelf frame/skeleton inside the catalog canvas, never a page replacement. Refresh errors keep populated content visible. Empty and hard-error states stay inside the right canvas so the app shell and actions remain stable.

## Verification

- Unit-test alphabet derivation/filtering, regular-face selection, unit conversion, CSS serialization, reset behavior, and slider keyboard math.
- Component-test the themed logo, active alphabet state, LTR editor, conditional axes, Copy CSS feedback, and mobile layout hooks.
- Browser-test desktop and mobile home layouts against the Figma proportions.
- Browser-test catalog card navigation, selection/mutations, uploads, search access, and scroll restoration after the shell change.
- Browser-test LTR typing, all metric controls, line-height modes, variable axes, Reset, and clipboard output on fixed and variable families.
- Run line-count, typecheck, lint, unit tests, production build, and focused browser flows before deployment; repeat critical flows on the deployed Vercel URL.

## Non-Goals

- No new theme palette or third visual color.
- No server-side alphabet query or cache schema change.
- No new font editor, OpenType feature panel, or multi-column text layout.
- No duplicate tester retained as a rollback path.
- No redesign of import, search, or detail metadata beyond keeping their entry points working.
