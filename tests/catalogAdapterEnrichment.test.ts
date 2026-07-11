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
        pairingHints: ['soft serifs'],
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
  });
});
