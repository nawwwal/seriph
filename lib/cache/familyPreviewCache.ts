'use client';

import type { FontFamily } from '@/models/font.models';
import type { ShelfFamily } from '@/models/shelf.models';
import {
  familyDetailPreview,
  previewFamilyFromShelf,
  type FamilyDetailPreviewInput,
} from '@/lib/cache/familyDetailPreview';

export { previewFamilyFromShelf } from '@/lib/cache/familyDetailPreview';

interface PreviewEntry {
  family: FontFamily;
  kind: FamilyDetailPreviewInput['kind'];
}

const previewsById = new Map<string, PreviewEntry>();

function cacheKey(uid: string, familyId: string): string {
  return `${uid}:${familyId}`;
}

function normalizeInput(input: FamilyDetailPreviewInput | ShelfFamily): FamilyDetailPreviewInput {
  return 'kind' in input ? input : { kind: 'shelf', family: input };
}

function setPreview(uid: string, familyId: string, entry: PreviewEntry): void {
  const key = cacheKey(uid, familyId);
  const existing = previewsById.get(key);
  if (existing?.kind === 'search' && entry.kind === 'shelf') return;
  previewsById.set(key, entry);
}

export function cacheFamilyPreview(
  uid: string,
  input: FamilyDetailPreviewInput | ShelfFamily,
): FontFamily {
  const normalized = normalizeInput(input);
  const preview = familyDetailPreview(normalized);
  const entry = { family: preview, kind: normalized.kind };
  setPreview(uid, preview.id, entry);
  if (preview.normalizedName !== preview.id) setPreview(uid, preview.normalizedName, entry);
  return preview;
}

export function getCachedFamilyPreview(uid: string | undefined, familyId: string | undefined): FontFamily | undefined {
  return uid && familyId ? previewsById.get(cacheKey(uid, familyId))?.family : undefined;
}

export function clearFamilyPreviewCacheForUser(uid: string): void {
  for (const key of previewsById.keys()) {
    if (key.startsWith(`${uid}:`)) previewsById.delete(key);
  }
}
