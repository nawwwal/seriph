# Mobile responsiveness verification

Verified on 2026-10-07 using the running app in the Codex browser, first with
Next.js development and then with the final production build at localhost:3000.
The unsigned-in landing and authentication forms were checked on localhost:3001.
Existing unrelated checkout edits were preserved. These screenshots record local
verification before release. The release branch applies only responsive changes
to current main (`525f510`); deployment is tracked by the pull request.

## Layout changes

### Hold structure until it breaks

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| HIGH | `components/layout/ShellFilterRail.tsx:17`, `components/layout/ScrollableRailAppShell.tsx:30`, `components/layout/AppShell.tsx:64` | The expanded alphabet/filter rail consumed almost all phone height. | Below 1024px, a 44px disclosure opens a scrollable panel over the canvas, bounded to 40dvh. Desktop keeps its full rail. | Filters remain available while the catalog retains its scroll area. |
| HIGH | `components/layout/AppShellHeader.tsx:22`, `components/layout/ScrollableRailAppShell.tsx:44`, `components/home/HomeHeaderSearch.tsx:59` | Logo and search competed for a narrow row; the prompt wrapped outside the header. | Separate narrow-screen rows, a smaller logo, bounded input width, and a single-line prompt; suggestions paint above filters. | The primary search stays visible and usable. |
| MEDIUM | `components/home/shelfGrid.ts:1`, `components/search/SearchWorkspace.tsx:46`, `components/search/SearchWorkspaceFallback.tsx:23` | Viewport breakpoints produced tiny cards beside the tablet sidebar. | Container queries choose one to four columns from available canvas width. | Cards preserve legible names and specimens. |

### Plan for growth and clipping

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| MEDIUM | `components/font/FamilyStyles.tsx:31`, `components/font/TypePlaygroundStyleSelect.tsx:37`, `components/font/CopyRow.tsx:20`, `components/font/FamilyHeader.tsx:19` | Detail controls competed for one row; copy fields lost most of their width. | Style actions wrap, the phone face picker takes its own row, copy labels stack above values, and long titles can wrap. | Actions and values remain reachable at 320px. |
| MEDIUM | `components/layout/AppFrame.tsx:42`, `components/layout/AppStatusStrip.tsx:18`, `components/upload/UploadTray.tsx:81`, `components/ui/Modal.tsx:45`, `styles/responsive-shell.css:2` | Static viewport height and large footer spacing could clip chrome; upload popups were anchored too far left; desktop inspection tools intercepted phone controls. | Dynamic viewport height, compact footer spacing, inset phone upload popup, scrollable bounded dialogs, safe-area padding, and hidden narrow-screen inspection toolbars. | Stable chrome and overlays fit the available viewport. |

## Browser checks

| Viewport | Checks performed |
| --- | --- |
| 320 × 568 | Search/refinement and result navigation; family title/tags; Test in Text; edited specimen; sliders and use-font rows; Bold style filter; import dialog; theme popup; public landing, sign-in, create-account forms. |
| 390 × 844 | Shelf and inner scrolling; filter disclosure; shelf Voice filter; search suggestions and Enter submission; search results; final floating panel and suggestion stacking. |
| 768 × 1024 | Shelf shows two readable columns with collapsed filters; footer remains accessible. |
| 844 × 390 | Search header; opening/closing filters preserves the canvas; import dialog fits the short viewport; public password-reset form. |
| 1440 × 900 | Full desktop rail, alphabet/Voice/Build/Mood sections, three-column shelf, and footer. |

DOM measurements confirmed document width equals viewport width at 320, 390,
844, and 1440px. At 320px, the family canvas also had equal client/scroll widths.
Catalog navigation and editable previews were exercised using the existing
signed-in browser session; authentication screens used a separate unsigned-in
origin. No font upload, deletion, merge, or authentication submission was needed.

## Validation and limits

Release checks on the clean branch based on current main:

- `npm run lint:secrets`: passed.
- `npm run lint:web`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed using the supported Node 24 runtime.
- `git diff --check`: passed.

Earlier local checks passed 57 tests with one skipped. Current main has removed
that unit-test infrastructure and line-count gate; neither is part of this release.

- Not verified: physical iOS/Android devices, virtual-keyboard and safe-area
  behavior on devices, 200% browser zoom, RTL/pseudo-localization, or an active
  upload/recovery batch. The upload tray positioning changes were inspected in source.

## Screenshots

- [Shelf at 390px](mobile-responsive/shelf-390.jpg)
- [Open filters at 390px](mobile-responsive/filters-390.jpg)
- [Search at 390px](mobile-responsive/search-390.jpg)
- [Family detail at 320px](mobile-responsive/detail-320.jpg)
- [Edited tester at 320px](mobile-responsive/tester-320.jpg)
- [Import at 320px](mobile-responsive/import-320.jpg)
- [Tablet shelf](mobile-responsive/shelf-768.jpg)
- [Desktop shelf](mobile-responsive/shelf-1440.jpg)

The inspected browser layouts passed. Device-specific checks remain unverified.
