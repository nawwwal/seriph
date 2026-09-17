import { describe, expect, it } from 'vitest';
import { mapCatalogDoc } from '@/lib/db/catalogAdapter';

describe('mapCatalogDoc enrichment', () => {
  it('maps summary moods useCases voice pairingHints', () => {
    const family = mapCatalogDoc({
      name: 'ABC Ginto Nord',
      slug: 'abc-ginto-nord',
      category: 'SANS_SERIF',
      faces: [],
      enrichment: {
        summary: 'A sharp geometric grotesque.',
        moods: ['bold', 'editorial'],
        useCases: ['headlines'],
        voice: 'confident',
        pairingFamilies: [{ id: 'soft-serif', slug: 'soft-serif', name: 'soft serifs' }],
        classification: 'geometric sans',
      },
    }, 'doc-id');
    expect(family.description).toBe('A sharp geometric grotesque.');
    expect(family.tags).toContain('bold');
    expect(family.metadata.moods).toEqual(['bold', 'editorial']);
    expect(family.metadata.useCases).toEqual(['headlines']);
    expect(family.metadata.similarFamilies).toEqual(['soft serifs']);
    expect(family.metadata.technicalCharacteristics).toEqual(['confident']);
    expect(family.metadata.subClassification).toBe('geometric sans');
    expect(family.classification).toBe('Sans Serif');
  });

  it('uses Jev searchClass when category is wrong', () => {
    const family = mapCatalogDoc({
      name: 'Roboto Serif',
      slug: 'roboto-serif',
      category: 'SANS_SERIF',
      classification: 'Sans Serif',
      faces: [],
      enrichment: { searchClass: 'Serif', classification: 'transitional serif' },
    }, 'doc-id');
    expect(family.classification).toBe('Serif');
  });
});
