import { describe, expect, it } from 'vitest';
import { familyDetailPreviewFromSearch } from '@/lib/cache/familyDetailPreview';
import type { SearchResultItem } from '@/models/search.models';

function searchItem(): SearchResultItem {
  return {
    id: 'aeonik-id', slug: 'aeonik', name: 'Aeonik', normalizedName: 'aeonik',
    category: 'NEO_GROTESK', classification: 'Sans Serif',
    summary: 'A precise neo-grotesk.', moods: ['precise'], useCases: ['product UI'],
    styleCount: 12, isVariable: false, updatedAt: '2026-07-10T00:00:00.000Z',
  };
}

describe('family detail search preview', () => {
  it('keeps search summary, semantic tags, and classification', () => {
    const preview = familyDetailPreviewFromSearch(searchItem());

    expect(preview).toMatchObject({
      id: 'aeonik',
      description: 'A precise neo-grotesk.',
      tags: ['precise'],
      classification: 'Sans Serif',
      metadata: {
        moods: ['precise'],
        useCases: ['product UI'],
        enrichment: {
          classification: 'NEO_GROTESK',
          summary: 'A precise neo-grotesk.',
          moods: ['precise'],
          useCases: ['product UI'],
        },
      },
    });
  });
});
