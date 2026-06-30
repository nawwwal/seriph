'use client';

import type { ShelfScrollSnapshot } from '@/lib/shelf/shelfScrollSnapshot';

const ANCHOR_SELECTOR = '[data-shelf-family-id]';

function getFamilyId(node: Element): string | null {
  return node.getAttribute('data-shelf-family-id');
}

export function getShelfAnchorSnapshot(element: HTMLElement): Pick<ShelfScrollSnapshot, 'anchorFamilyId' | 'anchorOffset'> {
  const scrollerTop = element.getBoundingClientRect().top;
  let best: { id: string; offset: number; distance: number } | null = null;
  for (const node of Array.from(element.querySelectorAll<HTMLElement>(ANCHOR_SELECTOR))) {
    const id = getFamilyId(node);
    if (!id) continue;
    const rect = node.getBoundingClientRect();
    if (rect.bottom < scrollerTop || rect.top > window.innerHeight) continue;
    const offset = rect.top - scrollerTop;
    const distance = Math.abs(offset);
    if (!best || distance < best.distance) best = { id, offset, distance };
  }
  return { anchorFamilyId: best?.id ?? null, anchorOffset: Math.round(best?.offset ?? 0) };
}

export function restoreShelfAnchor(element: HTMLElement, snapshot: ShelfScrollSnapshot): boolean {
  if (!snapshot.anchorFamilyId) return false;
  const anchor = Array.from(element.querySelectorAll<HTMLElement>(ANCHOR_SELECTOR))
    .find((node) => getFamilyId(node) === snapshot.anchorFamilyId);
  if (!anchor) return false;
  const currentOffset = anchor.getBoundingClientRect().top - element.getBoundingClientRect().top;
  element.scrollTop += currentOffset - snapshot.anchorOffset;
  return true;
}
