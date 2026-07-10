import { describe, expect, it } from 'vitest';
import { adaptFamilyDoc, isCatalogAliasDoc, mergedInto } from '@/lib/db/catalogAdapter';

function catalogFamily(enrichment: Record<string, unknown>) {
  return adaptFamilyDoc({
    name: 'Aeonik Pro', slug: 'aeonik-pro', category: 'SANS_SERIF', faces: [], enrichment,
  }, 'aeonik-pro');
}

describe('catalog alias helpers', () => {
  it('recognizes merge tombstones as aliases instead of visible families', () => {
    const alias = {
      slug: 'abc-ginto-nord-black', status: 'merged', hidden: true, mergedInto: 'abc-ginto-nord',
    };

    expect(isCatalogAliasDoc(alias)).toBe(true);
    expect(mergedInto(alias)).toBe('abc-ginto-nord');
    expect(isCatalogAliasDoc({ slug: 'abc-ginto-nord', status: 'ready' })).toBe(false);
  });
});

describe('catalog family adapter', () => {
  it('maps every user-facing enrichment field from a catalog family', () => {
    const family = catalogFamily({
      classification: 'geometric sans',
      summary: 'A precise neo-grotesk.',
      moods: ['clear'],
      voice: 'calm and technical',
      useCases: ['product UI'],
      pairingHints: ['Pair with a literary serif'],
      confidence: 0.91,
      enrichedAt: '2026-07-10T00:00:00.000Z',
      modelId: 'gemini',
      promptVersion: 'v3',
    });

    expect(family.metadata.enrichment).toEqual({
      classification: 'geometric sans',
      summary: 'A precise neo-grotesk.',
      moods: ['clear'],
      voice: 'calm and technical',
      useCases: ['product UI'],
      pairingHints: ['Pair with a literary serif'],
      confidence: 0.91,
      enrichedAt: '2026-07-10T00:00:00.000Z',
    });
    expect(family.description).toBe('A precise neo-grotesk.');
    expect(family.metadata).not.toHaveProperty('enrichment.modelId');
    expect(family.metadata).not.toHaveProperty('enrichment.promptVersion');
  });

  it('omits malformed enrichment values at the catalog boundary', () => {
    const family = catalogFamily({
      classification: 17,
      summary: false,
      moods: 'clear',
      voice: ['technical'],
      useCases: { value: 'product UI' },
      pairingHints: null,
      confidence: 2,
      enrichedAt: 'last Thursday',
    });

    expect(family.metadata.enrichment).toEqual({});
    expect(family.description).toBe('');
  });
});
