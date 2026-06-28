import { describe, it, expect } from 'vitest';
import {
  snapWeight,
  weightNameFromNumber,
  parseStyle,
  familySlug,
  familyFileBase,
  staticStyleSuffix,
  orderAxisTags,
  canonicalFilename,
  gfCategory,
} from '../../src/storage/canonicalize';

describe('weights', () => {
  it('maps numbers to canonical GF names', () => {
    expect(weightNameFromNumber(400)).toBe('Regular');
    expect(weightNameFromNumber(600)).toBe('SemiBold');
    expect(weightNameFromNumber(900)).toBe('Black');
    expect(weightNameFromNumber(1000)).toBe('ExtraBlack');
  });

  it('snaps arbitrary usWeightClass to nearest canonical', () => {
    expect(snapWeight(420)).toBe(400);
    expect(snapWeight(640)).toBe(600);
    expect(snapWeight(50)).toBe(100);
  });
});

describe('parseStyle', () => {
  it('reads weight + italic from subfamily strings', () => {
    expect(parseStyle('Bold Italic')).toEqual({ weight: 700, weightName: 'Bold', italic: true });
    expect(parseStyle('SemiBold')).toEqual({ weight: 600, weightName: 'SemiBold', italic: false });
    expect(parseStyle('Italic')).toEqual({ weight: 400, weightName: 'Regular', italic: true });
    expect(parseStyle('Regular')).toEqual({ weight: 400, weightName: 'Regular', italic: false });
  });

  it('prefers a recognized name token over the matching substring order', () => {
    // "extrabold" must win over "bold"
    expect(parseStyle('ExtraBold').weight).toBe(800);
    expect(parseStyle('extra light').weight).toBe(200);
  });

  it('falls back to OS/2 weight when the name is unhelpful', () => {
    expect(parseStyle(undefined, 500)).toEqual({ weight: 500, weightName: 'Medium', italic: false });
    expect(parseStyle('', 730).weight).toBe(700);
  });
});

describe('family tokens', () => {
  it('slugs for directories', () => {
    expect(familySlug('IBM Plex Sans')).toBe('ibm-plex-sans');
    expect(familySlug('  Açaí Display!! ')).toBe('aa-display');
  });

  it('strips to a filename base preserving case', () => {
    expect(familyFileBase('IBM Plex Sans')).toBe('IBMPlexSans');
    expect(familyFileBase('Playpen Sans')).toBe('PlaypenSans');
  });
});

describe('static filenames', () => {
  it('special-cases Regular/Italic and combines weight+italic', () => {
    expect(staticStyleSuffix(400, false)).toBe('Regular');
    expect(staticStyleSuffix(400, true)).toBe('Italic');
    expect(staticStyleSuffix(700, true)).toBe('BoldItalic');
    expect(staticStyleSuffix(500, false)).toBe('Medium');
  });

  it('builds canonical static filenames', () => {
    expect(canonicalFilename('Roboto', { variable: false, italic: false, weight: 400 }, 'woff2')).toBe(
      'Roboto-Regular.woff2'
    );
    expect(canonicalFilename('Roboto', { variable: false, italic: true, weight: 700 }, 'ttf')).toBe(
      'Roboto-BoldItalic.ttf'
    );
  });
});

describe('variable axis ordering + filenames', () => {
  it('orders custom (UPPER) first, registered alphabetical, wght last', () => {
    expect(orderAxisTags(['wght', 'wdth'])).toEqual(['wdth', 'wght']);
    expect(orderAxisTags(['wght', 'GOOF', 'VEST', 'wdth'])).toEqual(['GOOF', 'VEST', 'wdth', 'wght']);
    expect(orderAxisTags(['wght', 'opsz'])).toEqual(['opsz', 'wght']);
  });

  it('builds canonical variable filenames incl. italic', () => {
    expect(
      canonicalFilename('NotoSans', { variable: true, italic: false, axisTags: ['wght', 'wdth'] }, 'ttf')
    ).toBe('NotoSans[wdth,wght].ttf');
    expect(
      canonicalFilename('Inter', { variable: true, italic: true, axisTags: ['opsz', 'wght'] }, 'woff2')
    ).toBe('Inter-Italic[opsz,wght].woff2');
  });
});

describe('gfCategory', () => {
  it('maps loose classifications to GF primary categories', () => {
    expect(gfCategory('Sans Serif')).toBe('SANS_SERIF');
    expect(gfCategory('Serif')).toBe('SERIF');
    expect(gfCategory('Script & Handwriting')).toBe('HANDWRITING');
    expect(gfCategory('Display & Decorative')).toBe('DISPLAY');
    expect(gfCategory('whatever', true)).toBe('MONOSPACE');
  });
});
