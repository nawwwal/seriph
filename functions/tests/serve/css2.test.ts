import { describe, it, expect } from 'vitest';
import {
  parseFamilySpec,
  parseCss2Query,
  resolveFace,
  buildCss2,
} from '../../src/serve/css2';
import type { FontFamilyDoc, FontFace } from '../../src/models/catalog.models';

function face(partial: Partial<FontFace> & { id: string }): FontFace {
  return {
    styleName: 'Regular',
    weight: 400,
    weightName: 'Regular',
    italic: false,
    isVariable: false,
    format: 'TTF',
    fileSize: 1000,
    filename: 'X.woff2',
    woff2: { storagePath: 's/x/1/X.woff2', url: 'https://cdn.test/s/x/1/X.woff2' },
    original: { storagePath: 'd/x/1/X.ttf', url: 'https://cdn.test/d/x/1/X.ttf' },
    ...partial,
  };
}

const interVariable: FontFamilyDoc = {
  id: 'inter',
  slug: 'inter',
  name: 'Inter',
  fileBase: 'Inter',
  category: 'SANS_SERIF',
  status: 'enriched',
  version: 1,
  faces: [
    face({
      id: 'vf',
      styleName: 'Variable',
      isVariable: true,
      axes: [{ tag: 'wght', min: 100, max: 900, default: 400 }],
      filename: 'Inter[wght].woff2',
      woff2: { storagePath: 's/inter/1/Inter[wght].woff2', url: 'https://cdn.test/s/inter/1/Inter[wght].woff2' },
    }),
  ],
};

const roboto: FontFamilyDoc = {
  id: 'roboto',
  slug: 'roboto',
  name: 'Roboto',
  fileBase: 'Roboto',
  category: 'SANS_SERIF',
  status: 'ready',
  version: 2,
  faces: [
    face({ id: 'regular', weight: 400, filename: 'Roboto-Regular.woff2',
      woff2: { storagePath: 's/roboto/2/Roboto-Regular.woff2', url: 'https://cdn.test/s/roboto/2/Roboto-Regular.woff2' } }),
    face({ id: 'bold', weight: 700, weightName: 'Bold', styleName: 'Bold', filename: 'Roboto-Bold.woff2',
      woff2: { storagePath: 's/roboto/2/Roboto-Bold.woff2', url: 'https://cdn.test/s/roboto/2/Roboto-Bold.woff2' } }),
  ],
};

describe('parseFamilySpec', () => {
  it('plain family defaults to normal 400', () => {
    expect(parseFamilySpec('Inter')).toEqual({ family: 'Inter', slug: 'inter', styles: [{ italic: false, weight: 400 }] });
  });
  it('wght list', () => {
    expect(parseFamilySpec('Inter:wght@400;700').styles).toEqual([
      { italic: false, weight: 400 },
      { italic: false, weight: 700 },
    ]);
  });
  it('ital,wght tuples', () => {
    expect(parseFamilySpec('Inter:ital,wght@0,400;1,700').styles).toEqual([
      { italic: false, weight: 400 },
      { italic: true, weight: 700 },
    ]);
  });
  it('plus-encoded family name + variable range', () => {
    const r = parseFamilySpec('Roboto+Mono:wght@400..700');
    expect(r.family).toBe('Roboto Mono');
    expect(r.slug).toBe('roboto-mono');
    expect(r.styles).toEqual([{ italic: false, weight: [400, 700] }]);
  });
});

describe('parseCss2Query', () => {
  it('parses multiple families + display', () => {
    const p = new URLSearchParams('family=Inter&family=Roboto:wght@700&display=optional');
    const { families, display } = parseCss2Query(p);
    expect(families.map((f) => f.slug)).toEqual(['inter', 'roboto']);
    expect(display).toBe('optional');
  });
  it('falls back to swap for invalid display', () => {
    expect(parseCss2Query(new URLSearchParams('family=Inter&display=nope')).display).toBe('swap');
  });
});

describe('resolveFace', () => {
  it('variable face covers any requested weight', () => {
    expect(resolveFace(interVariable, { italic: false, weight: 250 })?.id).toBe('vf');
    expect(resolveFace(interVariable, { italic: false, weight: [100, 900] })?.id).toBe('vf');
  });
  it('static picks nearest weight with matching italic', () => {
    expect(resolveFace(roboto, { italic: false, weight: 600 })?.id).toBe('bold');
    expect(resolveFace(roboto, { italic: false, weight: 300 })?.id).toBe('regular');
  });
});

describe('buildCss2', () => {
  const resolve = (slug: string) => ({ inter: interVariable, roboto }[slug]);

  it('emits a variable @font-face with weight range + cdn url', () => {
    const css = buildCss2([parseFamilySpec('Inter:wght@100..900')], 'swap', resolve);
    expect(css).toContain("font-family: 'Inter'");
    expect(css).toContain('font-weight: 100 900');
    expect(css).toContain("src: url(https://cdn.test/s/inter/1/Inter[wght].woff2) format('woff2')");
    expect(css).toContain('font-display: swap');
  });

  it('emits static faces and dedupes repeats', () => {
    const css = buildCss2([parseFamilySpec('Roboto:wght@400;700;700')], 'block', resolve);
    expect(css.match(/@font-face/g)?.length).toBe(2);
    expect(css).toContain('font-weight: 700');
  });

  it('skips unknown families', () => {
    expect(buildCss2([parseFamilySpec('Nonexistent')], 'swap', resolve)).toBe('');
  });
});
