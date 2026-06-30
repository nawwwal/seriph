# Base UI Primitives Migration Plan

> **For Adi:** preserve Seriph's existing visual and interaction feel while replacing hand-rolled interactive controls with local primitives backed by Base UI. Base UI stays below the surface; Seriph classes, CSS variables, and product behavior remain the visible contract.

**Goal:** Audit Seriph's UI controls against current Base UI React primitives, migrate the safe matching controls, and document deferred native-control migrations where a direct Base UI swap would visibly change platform chrome.

**Architecture:** Keep the same pattern established by `components/ui/Button.tsx`: Base UI parts are imported only inside Seriph-owned `components/ui/*` primitives or tightly-scoped migrated components. Styling remains in local class builders and existing Tailwind/CSS variable utilities. Call sites should read like product components, not Base UI demos.

**Base UI source context:**
- Base UI is unstyled and className-driven, so existing Seriph classes can be placed on primitive parts.
- `Input` renders a native `<input>` and is safe for visually exact text/search/password/email fields.
- `Dialog` and `AlertDialog` provide modal focus/escape/outside-dismiss behavior and replace local key listeners.
- `Menu` is the correct primitive for action dropdowns such as profile/account menus.
- `Select` is the correct primitive for predefined value pickers; Base UI does not expose a standalone Listbox primitive.
- `Autocomplete` is the better target for search suggestions; `Combobox` is for restricted searchable picking.
- `Checkbox` and `Slider` are available, but replacing native checkbox/range surfaces needs explicit visual restyling to avoid browser chrome drift.

**Current control map:**
- `components/layout/NavSearch.tsx`: text search input plus a custom suggestion panel. Migrate the input to Base UI `Input`; keep the suggestion panel for this slice, plan `Autocomplete` later because it changes popup ownership and keyboard behavior.
- `components/search/SearchWorkspace.tsx`: full search text input. Migrate to Base UI `Input`.
- `components/auth/AuthFormParts.tsx`: email/password inputs. Migrate to Base UI `Input`.
- `components/home/DeleteFamiliesDialog.tsx`: destructive confirmation overlay and confirmation input. Migrate overlay to Base UI `AlertDialog`, input to Base UI `Input`.
- `components/ui/Modal.tsx`: shared upload modal. Migrate to Base UI `Dialog`.
- `components/layout/ProfileMenu.tsx`: account action dropdown. Migrate to Base UI `Menu` while keeping avatar/menu item classes.
- `components/theme/ThemeSwitcher.tsx`: predefined theme picker with hover preview. Migrate to Base UI `Select` if hover preview and visual classes can be preserved; otherwise keep current listbox in this slice and leave as a planned Select/Autocomplete follow-up.
- `components/home/FamilyContextMenu.tsx`: coordinate-positioned right-click menu. Base UI has `ContextMenu`, but current ownership is parent-coordinate driven. Keep unchanged in this slice unless a wrapper can preserve exact positioning.
- `components/search/SearchFilterPanel.tsx`: checkbox filters. Candidate for Base UI `Checkbox`, but native checkbox appearance could change; defer unless a local checkbox visual primitive is added.
- `components/font/TypeTester.tsx`: native `<select>` controls. Base UI `Select` would replace browser-native select chrome with a custom popup, so defer until a local Select primitive is designed and visually accepted.
- `components/font/AxisSlider.tsx` and `VariableFontPlaygroundControls.tsx`: native range inputs styled by `.theme-range`. Base UI `Slider` is available but would need a bespoke track/thumb visual wrapper; defer.
- File inputs in upload/dropzone/header: keep native hidden inputs; Base UI has no better primitive for the actual file-picker.

## Task 1: Add Shared Text Input Primitive

**Files:**
- Create `components/ui/textInputStyles.ts`
- Create `components/ui/TextInput.tsx`
- Add `tests/textInputStyles.test.ts`

**Steps:**
1. Add failing tests that assert the shared style builder preserves the current class strings for:
   - nav search input
   - full search input
   - auth form input
   - destructive confirmation input
2. Implement `textInputClassName()` with size variants and `cn()`.
3. Implement `TextInput` as a thin wrapper around `@base-ui/react/input`.
4. Migrate current text/search/auth/confirmation inputs to `TextInput` without changing props, labels, placeholders, or class strings.

**Verification:**
- `npm test -- tests/textInputStyles.test.ts`
- `npm run typecheck -- --pretty false`

## Task 2: Replace Shared Modal With Base UI Dialog

**Files:**
- Update `components/ui/Modal.tsx`

**Steps:**
1. Keep the existing public `Modal` props.
2. Replace manual `keydown` and focus code with `Dialog.Root`, `Dialog.Portal`, `Dialog.Backdrop`, `Dialog.Popup`, `Dialog.Title`, and `Dialog.Close`.
3. Preserve these visual classes:
   - overlay: `fixed inset-0 theme-overlay z-50 flex items-center justify-center p-4 transition-opacity duration-300 ease-in-out`
   - content: `bg-[var(--surface)] text-[var(--on-surface)] rule rounded-[var(--radius)] theme-shadow-xl transform transition-all duration-300 ease-in-out w-full ... p-6 relative theme-focus-ring`
4. Preserve title spacing, close button style, and described-by wiring.

**Verification:**
- Typecheck.
- Browser check upload center open/close/Escape.

## Task 3: Replace Delete Confirmation With Base UI AlertDialog

**Files:**
- Update `components/home/DeleteFamiliesDialog.tsx`

**Steps:**
1. Use `AlertDialog.Root` controlled open with no trigger because the parent conditionally renders it.
2. Use `AlertDialog.Portal`, `AlertDialog.Backdrop`, `AlertDialog.Popup`, `AlertDialog.Title`, `AlertDialog.Description`, and close buttons where possible.
3. Preserve the existing paper card, overlay, title, error, confirmation input, and button styling.
4. Keep the `DELETE` confirmation contract unchanged.

**Verification:**
- Typecheck.
- Browser check delete dialog computed overlay/card styles if reachable; otherwise rely on component compile plus unchanged classes.

## Task 4: Replace Profile Dropdown With Base UI Menu

**Files:**
- Update `components/layout/ProfileMenu.tsx`

**Steps:**
1. Use controlled `Menu.Root` keyed by the current user id.
2. Use `Menu.Trigger` with the existing avatar button classes via the existing `Button` style builder or direct Base UI render if needed.
3. Use `Menu.Portal`, `Menu.Positioner`, `Menu.Popup`, and `Menu.Item`.
4. Preserve popup classes: `w-44 rounded-[var(--radius)] bg-[var(--paper)] rule theme-shadow-lg overflow-hidden z-20`.
5. Preserve sign-out behavior and account label copy.

**Verification:**
- Typecheck.
- Browser check avatar menu opens, closes on outside press/Escape, and styles match.

## Task 5: Decide Theme Switcher Migration By Behavior

**Files:**
- `components/theme/ThemeSwitcher.tsx`
- `components/theme/ThemeMenuOption.tsx`

**Steps:**
1. Attempt Base UI `Select` only if it can preserve:
   - trigger classes exactly
   - popup width/right alignment
   - hover preview via pointer enter
   - keyboard highlight preview
   - selected theme persistence
2. If Base UI `Select` cannot expose highlight changes cleanly without fragile DOM/state work, keep the current theme listbox for this slice and document it as a follow-up wrapper task.

**Verification:**
- Browser computed style for trigger and popup.
- Theme hover/pick behavior.

## Task 6: Record Deferred Native-Control Migrations

**Files:**
- Update `.agents/frontend-ux.md`
- Update durable Seriph note after verification

**Steps:**
1. Record that native selects, sliders, checkboxes, and search Autocomplete are planned Base UI wrapper candidates but not blindly swapped because visual equivalence requires bespoke local wrappers.
2. Record implemented primitives and the no-visual-change rule.

**Verification:**
- `qmd update`
- `qmd embed -c "knowledge base"` if durable notes changed

## Task 7: Full Verification

Run:
1. `npm test -- tests/textInputStyles.test.ts`
2. `npm run typecheck -- --pretty false`
3. `npm run lint:web`
4. `npm test`
5. `npm run build`
6. `git diff --check`
7. Browser checks on `/` and any reachable dialog/menu/search surfaces.

Stop and fix failures before marking the goal complete.
