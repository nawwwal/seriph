import { describe, expect, it } from 'vitest';
import { buildSplitFamilyMergePlan } from '../../src/scripts/mergeSplitFamilies';
import { reparseOriginalFaces } from '../../src/scripts/mergeSplitOriginals';
import type { FontFace, FontFamilyDoc } from '../../src/models/catalog.models';

function face(): FontFace {
  return {
    id: 'regular',
    styleName: 'Regular',
    weight: 400,
    weightName: 'Regular',
    italic: false,
    isVariable: false,
    format: 'OTF',
    postScriptName: 'AeonikPro-Light',
    fileSize: 42,
    filename: 'AeonikProLight-Regular.woff2',
    woff2: { storagePath: 's/aeonik.woff2', url: 'https://example.com/aeonik.woff2' },
    original: { storagePath: 'd/AeonikProLight-Regular.otf', url: 'https://example.com/aeonik.otf' },
    contentHash: 'hash-light',
  };
}

function family(): FontFamilyDoc {
  return {
    id: 'owner-1__aeonik-pro-light',
    slug: 'aeonik-pro-light',
    name: 'Aeonik Pro Light',
    fileBase: 'AeonikProLight',
    category: 'SANS_SERIF',
    faces: [face()],
    ownerId: 'owner-1',
    status: 'enriched',
    version: 1,
  };
}

describe('reparseOriginalFaces', () => {
  it('rebuilds split-family plans from OpenType preferred names', async () => {
    const families = await reparseOriginalFaces([family()], {
      fetchOriginal: async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        arrayBuffer: async () => Buffer.from('font-bytes').buffer,
      }),
      parseFont: async () => ({
        familyName: 'Aeonik Pro Light',
        subfamilyName: 'Regular',
        preferredFamily: 'Aeonik Pro',
        preferredSubfamily: 'Light',
        postScriptName: 'AeonikPro-Light',
        fullName: 'Aeonik Pro Light',
        weight: 300,
        format: 'OTF',
      }),
    });

    const plan = buildSplitFamilyMergePlan(families);
    expect(plan.targets[0]).toMatchObject({ slug: 'aeonik-pro', aliases: ['aeonik-pro-light'] });
    expect(plan.targets[0]?.faces[0]).toMatchObject({
      id: 'light',
      styleName: 'Light',
      weight: 300,
      meta: {
        familyName: 'Aeonik Pro Light',
        preferredFamily: 'Aeonik Pro',
        preferredSubfamily: 'Light',
      },
    });
  });
});
