import { describe, expect, it } from 'vitest';
import {
  canonicalFilename,
  orderAxisTags,
  resolveCanonicalFontIdentity,
  staticStyleSuffix,
} from '../../src/storage/canonicalize';

describe('static filenames', () => {
  it('special-cases Regular/Italic and combines weight+italic', () => {
    expect(staticStyleSuffix(400, false)).toBe('Regular');
    expect(staticStyleSuffix(400, true)).toBe('Italic');
    expect(staticStyleSuffix(700, true)).toBe('BoldItalic');
    expect(staticStyleSuffix(500, false)).toBe('Medium');
  });

  it('builds canonical static filenames', () => {
    expect(canonicalFilename('Roboto', { variable: false, italic: false, weight: 400 }, 'woff2')).toBe('Roboto-Regular.woff2');
    expect(canonicalFilename('Roboto', { variable: false, italic: true, weight: 700 }, 'ttf')).toBe('Roboto-BoldItalic.ttf');
  });

  it('keeps width/cut descriptors in filenames when they are part of the face style', () => {
    expect(canonicalFilename('HD Colton', { variable: false, italic: true, weight: 900, styleName: 'Wide Black Italic' }, 'otf')).toBe(
      'HDColton-WideBlackItalic.otf'
    );
  });
});

describe('variable axis ordering + filenames', () => {
  it('orders custom first, registered alphabetical, wght last', () => {
    expect(orderAxisTags(['wght', 'wdth'])).toEqual(['wdth', 'wght']);
    expect(orderAxisTags(['wght', 'GOOF', 'VEST', 'wdth'])).toEqual(['GOOF', 'VEST', 'wdth', 'wght']);
    expect(orderAxisTags(['wght', 'opsz'])).toEqual(['opsz', 'wght']);
  });

  it('builds canonical variable filenames incl. italic', () => {
    expect(canonicalFilename('NotoSans', { variable: true, italic: false, axisTags: ['wght', 'wdth'] }, 'ttf')).toBe(
      'NotoSans[wdth,wght].ttf'
    );
    expect(canonicalFilename('Inter', { variable: true, italic: true, axisTags: ['opsz', 'wght'] }, 'woff2')).toBe(
      'Inter-Italic[opsz,wght].woff2'
    );
  });

  it('drops generic variable naming from the family while preserving the cut', () => {
    const identity = resolveCanonicalFontIdentity({
      familyName: 'ABC Ginto Plus Variable',
      subfamilyName: 'Regular',
      postScriptName: 'ABCGintoPlusVariable-Regular',
      isVariable: true,
    });

    expect(identity).toMatchObject({ familyName: 'ABC Ginto Plus', styleName: 'Variable', slug: 'abc-ginto-plus', fileBase: 'ABCGintoPlus' });
    expect(canonicalFilename(identity.familyName, { variable: true, italic: false, axisTags: ['ital', 'wght'], styleName: identity.styleName }, 'ttf')).toBe(
      'ABCGintoPlus[ital,wght].ttf'
    );
  });
});
