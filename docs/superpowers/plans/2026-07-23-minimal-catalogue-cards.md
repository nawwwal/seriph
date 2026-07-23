# Minimal Catalogue Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimal, single-plane catalogue card based on the supplied specimen-card reference.

**Architecture:** Keep data and interaction logic in `FamilyCover`, render the hierarchy in `FamilyCoverBody`, and make `ShelfCardSkeletons` use the same anatomy. Remove the obsolete footer metadata component and the unused search-summary prop.

**Tech Stack:** React 19, Next.js 16, TypeScript, Tailwind CSS utilities

## Global Constraints

- Keep the existing outer card rule, radius, hover behaviour, selection state, navigation, and lazy font registration.
- Use no internal separator or split background.
- Add no unit tests; verify the real catalogue boundary in the running browser.
- Do not start another local server.

---

### Task 1: Build the single-plane card

**Files:**
- Modify: `components/font/familyCoverBody.tsx`
- Modify: `components/font/FamilyCover.tsx`
- Modify: `components/search/SearchResultCard.tsx`
- Delete: `components/font/familyCoverMeta.tsx`

**Interfaces:**
- Consumes: family name, style count, variable state, classification, and viewport normalization state.
- Produces: one card body with readable identity, quiet metadata, and normalized specimen text.

- [ ] **Step 1: Replace the split body**

Render one padded flex column with the family name and metadata at the top, `Aa` as the primary specimen, and fixed uppercase and lowercase comparison lines below it.

- [ ] **Step 2: Remove obsolete inputs**

Remove `sampleChars` and `description` from the cover-body interface, remove the search-summary handoff, and delete the footer-only metadata component.

- [ ] **Step 3: Run focused static checks**

Run:

```bash
npx eslint components/font/FamilyCover.tsx components/font/familyCoverBody.tsx components/search/SearchResultCard.tsx
npm run typecheck
```

Expected: both commands exit successfully.

### Task 2: Match the loading state and verify integration

**Files:**
- Modify: `components/home/ShelfSkeleton.tsx`

**Interfaces:**
- Consumes: the shared catalogue grid.
- Produces: loading cards with the same spacing and hierarchy as loaded cards.

- [ ] **Step 1: Rebuild the skeleton anatomy**

Use one padded card plane with two identity bars, a large `Aa` placeholder, and two specimen-line placeholders. Do not add a separator or a second background.

- [ ] **Step 2: Run focused static checks**

Run:

```bash
npx eslint components/home/ShelfSkeleton.tsx
npm run typecheck
git diff --check
```

Expected: all commands exit successfully.

- [ ] **Step 3: Verify the live catalogue**

Open the existing `http://localhost:3000/` tab. Confirm family names lead the hierarchy, specimens render in each family face, cards have no internal separator, and the grid remains aligned at desktop and narrow widths.

- [ ] **Step 4: Commit and push**

Stage only the intended card, skeleton, code-field, spec, and plan files. Commit the coherent UI changes and push `main`.
