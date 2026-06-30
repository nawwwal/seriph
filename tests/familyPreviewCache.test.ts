import { describe, expect, it } from 'vitest';
import {
  cacheFamilyPreview,
  clearFamilyPreviewCacheForUser,
  getCachedFamilyPreview,
  previewFamilyFromShelf,
} from '@/lib/cache/familyPreviewCache';
import type { ShelfFamily } from '@/models/shelf.models';

function shelfFamily(overrides: Partial<ShelfFamily> = {}): ShelfFamily {
  return {
    id: 'inter',
    name: 'Inter',
    normalizedName: 'inter',
    classification: 'Sans Serif',
    styleCount: 12,
    isVariable: false,
    updatedAt: '2026-07-01T00:00:00.000Z',
    coverFace: {
      id: 'regular',
      subfamily: 'Regular',
      weight: 400,
      italic: false,
      isVariable: false,
      cdnUrl: 'https://seriph.web.app/s/inter/regular.woff2',
    },
    ...overrides,
  };
}

describe('family preview cache', () => {
  it('creates a first-paint family from shelf data', () => {
    const preview = previewFamilyFromShelf(shelfFamily());

    expect(preview).toMatchObject({
      id: 'inter',
      name: 'Inter',
      classification: 'Sans Serif',
      fonts: [{ id: 'regular', weight: 400, format: 'WOFF2' }],
    });
    expect(preview.fonts[0]?.metadata.cdnUrl).toContain('/regular.woff2');
  });

  it('caches previews by route id and normalized id per user', () => {
    clearFamilyPreviewCacheForUser('user-a');
    cacheFamilyPreview('user-a', shelfFamily({ id: 'Inter Display', normalizedName: 'inter-display' }));

    expect(getCachedFamilyPreview('user-a', 'Inter Display')?.name).toBe('Inter');
    expect(getCachedFamilyPreview('user-a', 'inter-display')?.name).toBe('Inter');
    expect(getCachedFamilyPreview('user-b', 'inter-display')).toBeUndefined();
  });
});
