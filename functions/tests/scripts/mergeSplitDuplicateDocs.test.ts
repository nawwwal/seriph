import { describe, expect, it } from 'vitest';
import { buildSplitFamilyMergePlan } from '../../src/scripts/mergeSplitFamilies';
import type { FontFace, FontFamilyDoc } from '../../src/models/catalog.models';

function face(id: string, styleName: string): FontFace {
  return {
    id,
    styleName,
    weight: id.includes('light') ? 300 : 400,
    weightName: id.includes('light') ? 'Light' : 'Regular',
    italic: false,
    isVariable: false,
    format: 'OTF',
    fileSize: 42,
    filename: `${id}.woff2`,
    woff2: { storagePath: `s/${id}.woff2`, url: `https://example.com/${id}.woff2` },
    original: { storagePath: `d/${id}.otf`, url: `https://example.com/${id}.otf` },
    contentHash: `hash-${id}`,
  };
}

function family(id: string, slug: string, name: string, faces: FontFace[]): FontFamilyDoc {
  return {
    id,
    slug,
    name,
    fileBase: name.replace(/[^A-Za-z0-9]/g, ''),
    category: 'SANS_SERIF',
    faces,
    ownerId: 'owner-1',
    status: 'ready',
    version: 1,
  };
}

describe('buildSplitFamilyMergePlan duplicate docs', () => {
  it('merges legacy same-slug docs into the owner-scoped canonical doc', () => {
    const plan = buildSplitFamilyMergePlan([
      family('aeonik-pro', 'aeonik-pro', 'Aeonik Pro', [face('regular', 'Regular')]),
      family('owner-1__aeonik-pro-light', 'aeonik-pro-light', 'Aeonik Pro Light', [
        {
          ...face('regular', 'Regular'),
          postScriptName: 'AeonikPro-Light',
          meta: {
            familyName: 'Aeonik Pro Light',
            subfamilyName: 'Regular',
            preferredFamily: 'Aeonik Pro',
            preferredSubfamily: 'Light',
          },
        },
      ]),
    ]);

    expect(plan.targets).toHaveLength(1);
    expect(plan.targets[0]).toMatchObject({
      docId: 'owner-1__aeonik-pro',
      slug: 'aeonik-pro',
      aliasDocIds: ['aeonik-pro', 'owner-1__aeonik-pro-light'],
    });
    expect(plan.targets[0]?.faces.map((item) => item.id)).toEqual(['light', 'regular']);
  });
});
