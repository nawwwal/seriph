import { describe, expect, it } from 'vitest';
import { buildSplitFamilyMergePlan } from '../../src/scripts/mergeSplitFamilies';
import type { FontFace, FontFamilyDoc } from '../../src/models/catalog.models';
function face(overrides: Partial<FontFace>): FontFace {
  const id = overrides.id ?? 'regular';
  return {
    id,
    styleName: overrides.styleName ?? 'Regular',
    weight: overrides.weight ?? 400,
    weightName: overrides.weightName ?? 'Regular',
    italic: overrides.italic ?? false,
    isVariable: overrides.isVariable ?? false,
    axes: overrides.axes,
    format: 'OTF',
    postScriptName: overrides.postScriptName,
    fullName: overrides.fullName,
    fileSize: 42,
    filename: `${id}.woff2`,
    woff2: { storagePath: `s/${id}.woff2`, url: `https://example.com/${id}.woff2` },
    original: { storagePath: `d/${id}.otf`, url: `https://example.com/${id}.otf` },
    contentHash: overrides.contentHash ?? `hash-${id}`,
  };
}
function family(id: string, name: string, faces: FontFace[], ownerId = 'owner-1'): FontFamilyDoc {
  return {
    id: `${ownerId}__${id}`,
    slug: id,
    name,
    fileBase: name.replace(/[^A-Za-z0-9]/g, ''),
    category: 'SANS_SERIF',
    faces,
    ownerId,
    status: 'enriched',
    version: 1,
  };
}
describe('buildSplitFamilyMergePlan', () => {
  it('merges ABC Ginto weight and variable split docs into the canonical cut family', () => {
    const plan = buildSplitFamilyMergePlan([
      family('abc-ginto-nord-black', 'ABC Ginto Nord Black', [
        face({ id: 'regular', postScriptName: 'ABCGintoNord-Black' }),
        face({ id: 'regular-italic', italic: true, styleName: 'Regular Italic', postScriptName: 'ABCGintoNord-BlackItalic' }),
      ]),
      family('abc-ginto-nord', 'ABC Ginto Nord', [
        face({ id: 'regular', postScriptName: 'ABCGintoNord-Regular' }),
        face({ id: 'bold', styleName: 'Bold', weight: 700, weightName: 'Bold', postScriptName: 'ABCGintoNord-Bold' }),
      ]),
      family('abc-ginto-nord-variable', 'ABC Ginto Nord Variable', [
        face({
          id: 'vf',
          styleName: 'Variable',
          isVariable: true,
          axes: [{ tag: 'wght', min: 100, max: 900, default: 400, name: 'Weight' }],
          postScriptName: 'ABCGintoNordVariable-Regular',
        }),
      ]),
    ]);

    const nord = plan.targets.find((target) => target.slug === 'abc-ginto-nord');
    expect(nord?.name).toBe('ABC Ginto Nord');
    expect(nord?.base?.slug).toBe('abc-ginto-nord');
    expect(nord?.aliases).toEqual(['abc-ginto-nord-black', 'abc-ginto-nord-variable']);
    expect(nord?.faces.map((item) => item.id)).toEqual(['regular', 'bold', 'black', 'black-italic', 'vf']);
    expect(nord?.faces.map((item) => item.styleName)).toContain('Black Italic');
    expect(plan.aliases).toEqual([
      {
        sourceSlug: 'abc-ginto-nord-black',
        sourceDocId: 'owner-1__abc-ginto-nord-black',
        targetSlug: 'abc-ginto-nord',
        targetDocId: 'owner-1__abc-ginto-nord',
      },
      {
        sourceSlug: 'abc-ginto-nord-variable',
        sourceDocId: 'owner-1__abc-ginto-nord-variable',
        targetSlug: 'abc-ginto-nord',
        targetDocId: 'owner-1__abc-ginto-nord',
      },
    ]);
    expect(plan.conflicts).toEqual([]);
  });
  it('does not merge equivalent canonical slugs across owners', () => {
    const plan = buildSplitFamilyMergePlan([
      family('abc-ginto-nord-black', 'ABC Ginto Nord Black', [face({ id: 'regular', postScriptName: 'ABCGintoNord-Black' })], 'owner-1'),
      family('abc-ginto-nord-black', 'ABC Ginto Nord Black', [face({ id: 'regular', postScriptName: 'ABCGintoNord-Black' })], 'owner-2'),
    ]);
    expect(plan.targets.map((target) => target.docId).sort()).toEqual([
      'owner-1__abc-ginto-nord',
      'owner-2__abc-ginto-nord',
    ]);
    expect(plan.aliases.map((alias) => alias.sourceDocId).sort()).toEqual([
      'owner-1__abc-ginto-nord-black',
      'owner-2__abc-ginto-nord-black',
    ]);
  });
});
