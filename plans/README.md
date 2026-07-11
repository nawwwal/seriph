# Animation plans — catalogue ↔ font detail

**Engine update:** Shell chrome is **Framer Motion** (`layout` + storyboard in
`lib/motion/catalogDetailStoryboard.ts`), not View Transitions. Plans 001–005
were VT-era; treat this README as historical for VT, current code as Framer.

Commit stamp: `ca4b9a1`

## Status

| # | Plan | Severity | Status | Depends on |
| --- | --- | --- | --- | --- |
| 001 | Rewrite storyboard + VT timeline tokens | HIGH | DONE | — |
| 002 | Header compress (stop whole-header morph) | HIGH | DONE | 001 |
| 003 | Orchestrate rail yield + canvas expand | HIGH | DONE | 001 |
| 004 | Content handoff + detail/status stagger | MEDIUM | DONE | 001 |
| 005 | Reverse path parity (detail → catalogue) | HIGH | DONE | 002, 003, 004 |

## Recommended execution order

1. **001** first — all timing tokens and CSS stages must exist before other plans wire to them.
2. **002** and **003** next (can be sequential; 002 is the feel-breaking jump the user reported).
3. **004** after chrome (header/rail/canvas) is coherent — detail stagger only helps once the shell handoff is right.
4. **005** last — reverse must reuse the same stages with inverted delays; do not invent a second timeline.

## What is wrong (one paragraph)

The storyboard comment describes a staged film, but the implementation fires almost everything at `0ms` in parallel, morphs the **entire header** as a shared element even though old/new chrome are unrelated UIs (search vs actions), uses `ease-in` on the rail, leaves the status strip and detail body unstaged, and has no true reverse choreography. Only the logo is a real shared visual, so only the logo reads as animated.

## Vocabulary (what we are building)

| Term | Role in this sequence |
| --- | --- |
| **Shared element transition** | Logo only (same mark, new size). |
| **Layout animation** | Header height, canvas width (group size/position). |
| **Orchestration** | Phased stages with delays, not everything at once. |
| **Stagger** | Status metrics + detail sections after shell settles. |
| **Crossfade** | Body content (catalogue grid ↔ family detail). |
| **Continuity transition** | Shell reconfiguration that keeps the frame identity. |
| **Asymmetric easing** | Exit faster / enter slightly slower + delayed. |
| **Direction-aware transition** | `nav-forward` vs `nav-back` transitionTypes. |

## Execute

```text
improve-animations execute plans/001-rewrite-catalog-detail-storyboard.md
# then 002 → 003 → 004 → 005
```

Or hand any single plan file to an executor agent. Plans are self-contained.
