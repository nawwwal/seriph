# Minimal Catalogue Cards Design

## Goal

Replace the catalogue card's split preview-and-footer layout with one minimal specimen plane that makes the family name readable and lets the font speak for itself.

## Chosen Direction

The card uses one background and one outer rule. It has no internal separator, tinted preview panel, badges, or description block.

Information appears in this order:

1. Family name in the app's interface typeface, so decorative fonts cannot make identity hard to read.
2. One quiet metadata line: style count, variable or static build, and classification.
3. A large `Aa` specimen in the family typeface.
4. Compact uppercase and lowercase specimen lines.

This follows the supplied reference while replacing weight labels with family identity. The fixed specimen content makes families easy to compare across the grid.

## Component Boundaries

- `FamilyCover` owns family data, navigation, selection state, and font registration.
- `FamilyCoverBody` owns the single-plane visual hierarchy and safe specimen normalization.
- `ShelfCardSkeletons` mirrors the same hierarchy inside the catalogue grid.
- The old footer-only metadata component is removed because the footer no longer exists.

## Responsive and Failure Behaviour

- Long names and metadata truncate rather than changing card height.
- Specimen lines stay on one line and clip only at the card's horizontal edge.
- Safe font-size adjustment applies to specimen text, not the readable interface label.
- Cards remain usable before a font face loads because the browser falls back without changing the structure.
- Selection controls remain overlaid in the top-right corner.

## Verification

Run focused lint and TypeScript checks, then inspect the live `/` catalogue in the existing browser at desktop and narrow widths. Confirm the real cards and loading skeletons share one visual anatomy and that decorative families do not clip vertically.
