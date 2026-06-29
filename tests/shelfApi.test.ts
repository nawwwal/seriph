import { describe, expect, it } from 'vitest';
import {
  decodeFamilyCursor,
  encodeFamilyCursor,
  mapCatalogDocToShelfFamily,
} from '@/lib/api/familyShelf';

describe('family shelf API helpers', () => {
  it('maps rebuilt catalog docs to lightweight shelf summaries', () => {
    const family = mapCatalogDocToShelfFamily(
      {
        slug: 'abc-ginto-nord',
        name: 'ABC Ginto Nord',
        ownerId: 'user-1',
        category: 'SANS_SERIF',
        updatedAt: '2026-06-29T10:00:00.000Z',
        coverFaceId: 'bold',
        faces: [
          {
            id: 'regular',
            styleName: 'Regular',
            weight: 400,
            weightName: 'Regular',
            italic: false,
            isVariable: false,
            filename: 'ABCGintoNord-Regular.woff2',
            fileSize: 1234,
            format: 'OTF',
            woff2: { url: 'https://seriph.web.app/s/abc/regular.woff2' },
          },
          {
            id: 'bold',
            styleName: 'Bold',
            weight: 700,
            weightName: 'Bold',
            italic: false,
            isVariable: true,
            filename: 'ABCGintoNord-Bold.woff2',
            fileSize: 2345,
            format: 'OTF',
            woff2: { url: 'https://seriph.web.app/s/abc/bold.woff2' },
          },
        ],
      },
      'abc-ginto-nord'
    );

    expect(family).toEqual({
      id: 'abc-ginto-nord',
      name: 'ABC Ginto Nord',
      normalizedName: 'abc-ginto-nord',
      classification: 'Sans Serif',
      styleCount: 2,
      isVariable: true,
      updatedAt: '2026-06-29T10:00:00.000Z',
      coverFace: {
        id: 'bold',
        subfamily: 'Bold',
        weight: 700,
        italic: false,
        isVariable: true,
        cdnUrl: 'https://seriph.web.app/s/abc/bold.woff2',
      },
    });
    expect(JSON.stringify(family)).not.toContain('faces');
    expect(JSON.stringify(family)).not.toContain('text_vec');
  });

  it('round-trips stable pagination cursors', () => {
    const cursor = encodeFamilyCursor({ sortValue: 'ABC Ginto Nord', id: 'abc-ginto-nord' });
    expect(decodeFamilyCursor(cursor)).toEqual({
      sortValue: 'ABC Ginto Nord',
      id: 'abc-ginto-nord',
    });
    expect(decodeFamilyCursor('not-valid')).toBeNull();
  });
});
