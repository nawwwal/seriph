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
  it('projects logical face variants from the canonical catalogue shape', () => {
    const family = adaptFamilyDoc({
      name: 'Atlas', slug: 'atlas', category: 'SANS_SERIF', faces: [{
        id: 'regular', styleName: 'Regular', weight: 400, weightName: 'Regular', italic: false,
        isVariable: false, format: 'WOFF2', filename: 'Atlas.woff2', fileSize: 42,
        preferredAssetId: 'woff2',
        woff2: { storagePath: 's/atlas/1/Atlas.woff2', url: 'https://cdn.test/s/Atlas.woff2' },
        original: { storagePath: 'd/atlas/1/Atlas.otf', url: 'https://cdn.test/d/Atlas.otf' },
        contentHash: 'woff2-hash',
        assets: [
          { id: 'otf', contentHash: 'otf-hash', containerFormat: 'OTF', technology: 'OTF', originalName: 'Atlas.otf',
            original: { storagePath: 'd/atlas/1/Atlas.otf', url: 'https://cdn.test/d/Atlas.otf' },
            source: { batchId: 'batch-1', sourceId: 'source-1', itemId: 'otf', originalPath: 'Atlas.otf' } },
          { id: 'woff2', contentHash: 'woff2-hash', containerFormat: 'WOFF2', technology: 'WOFF2', originalName: 'Atlas.woff2',
            original: { storagePath: 'd/atlas/1/Atlas.otf', url: 'https://cdn.test/d/Atlas.otf' },
            served: { storagePath: 's/atlas/1/Atlas.woff2', url: 'https://cdn.test/s/Atlas.woff2' },
            source: { batchId: 'batch-1', sourceId: 'source-1', itemId: 'woff2', originalPath: 'Atlas.woff2' } },
        ],
      }], enrichment: {},
    }, 'atlas');

    expect(family.fonts[0]).toMatchObject({ id: 'regular', format: 'WOFF2', filename: 'Atlas.woff2' });
    expect(family.fonts[0]?.metadata).toMatchObject({
      cdnUrl: 'https://cdn.test/s/Atlas.woff2', downloadUrl: 'https://cdn.test/d/Atlas.otf',
      preferredAssetId: 'woff2', assets: expect.arrayContaining([
        expect.objectContaining({ id: 'otf', containerFormat: 'OTF' }),
        expect.objectContaining({ id: 'woff2', containerFormat: 'WOFF2', served: expect.any(Object) }),
      ]),
    });
  });

  it('whitelists public asset fields and strips storage and source provenance', () => {
    const family = adaptFamilyDoc({
      name: 'Atlas', slug: 'atlas', category: 'SANS_SERIF', faces: [{
        id: 'regular', styleName: 'Regular', weight: 400, weightName: 'Regular', italic: false,
        isVariable: false, format: 'WOFF2', filename: 'Atlas.woff2', fileSize: 42,
        woff2: { storagePath: 's/private', url: 'https://cdn.test/s/Atlas.woff2' },
        original: { storagePath: 'd/private', url: 'https://cdn.test/d/Atlas.otf' },
        assets: [{ id: 'woff2', contentHash: 'hash', containerFormat: 'WOFF2', technology: 'WOFF2',
          parsedVersion: '1.2', originalName: 'Atlas.otf',
          original: { storagePath: 'd/private', url: 'https://cdn.test/d/Atlas.otf' },
          served: { storagePath: 's/private', url: 'https://cdn.test/s/Atlas.woff2' },
          source: { batchId: 'secret-batch', sourceId: 'secret-source', itemId: 'secret-item', originalPath: 'secret/path' } }],
      }], enrichment: {},
    }, 'atlas');

    const asset = (family.fonts[0]?.metadata.assets as Array<Record<string, unknown>>)[0];
    expect(Object.keys(asset).sort()).toEqual([
      'containerFormat', 'contentHash', 'id', 'original', 'originalName', 'parsedVersion', 'served', 'technology',
    ]);
    expect(asset).toMatchObject({
      id: 'woff2', contentHash: 'hash', containerFormat: 'WOFF2', technology: 'WOFF2',
      parsedVersion: '1.2', originalName: 'Atlas.otf',
      original: { url: 'https://cdn.test/d/Atlas.otf' }, served: { url: 'https://cdn.test/s/Atlas.woff2' },
    });
    expect(asset).not.toHaveProperty('source');
    expect(asset).not.toHaveProperty('original.storagePath');
    expect(asset).not.toHaveProperty('served.storagePath');
  });

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

  it('normalizes parseable enrichment dates to ISO date-time output', () => {
    const family = catalogFamily({ enrichedAt: 'July 10, 2026 00:00:00 UTC' });

    expect(family.metadata.enrichment).toEqual({ enrichedAt: '2026-07-10T00:00:00.000Z' });
  });
});
