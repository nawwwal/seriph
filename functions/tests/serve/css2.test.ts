import { describe, expect, it } from 'vitest';
import {
  buildCss2,
  parseCss2Query,
  parseFamilySpec,
  resolveFace,
} from '../../src/serve/css2';
import { interVariable, roboto } from './css2Fixtures';

describe('parseFamilySpec', () => {
  it('plain family defaults to normal 400', () => {
    expect(parseFamilySpec('Inter')).toEqual({ family: 'Inter', slug: 'inter', styles: [{ italic: false, weight: 400 }] });
  });

  it('parses weight lists, ital tuples, plus names, and variable ranges', () => {
    expect(parseFamilySpec('Inter:wght@400;700').styles).toEqual([{ italic: false, weight: 400 }, { italic: false, weight: 700 }]);
    expect(parseFamilySpec('Inter:ital,wght@0,400;1,700').styles).toEqual([{ italic: false, weight: 400 }, { italic: true, weight: 700 }]);
    expect(parseFamilySpec('Roboto+Mono:wght@400..700')).toMatchObject({
      family: 'Roboto Mono',
      slug: 'roboto-mono',
      styles: [{ italic: false, weight: [400, 700] }],
    });
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
  it('uses variable faces for ranges and nearest static faces otherwise', () => {
    expect(resolveFace(interVariable, { italic: false, weight: 250 })?.id).toBe('vf');
    expect(resolveFace(interVariable, { italic: false, weight: [100, 900] })?.id).toBe('vf');
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

  it('emits static faces, dedupes repeats, and skips unknown families', () => {
    const css = buildCss2([parseFamilySpec('Roboto:wght@400;700;700')], 'block', resolve);
    expect(css.match(/@font-face/g)?.length).toBe(2);
    expect(css).toContain('font-weight: 700');
    expect(buildCss2([parseFamilySpec('Nonexistent')], 'swap', resolve)).toBe('');
  });
});
