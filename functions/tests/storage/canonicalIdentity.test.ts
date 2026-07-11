import { describe, expect, it } from 'vitest';
import { canonicalFaceId, gfCategory, resolveCanonicalFontIdentity } from '../../src/storage/canonicalize';

describe('canonical font identity', () => {
  it('uses typographic names so ABC Ginto cuts stay families and weights become faces', () => {
    expect(resolveCanonicalFontIdentity({
      familyName: 'ABC Ginto Nord Black',
      subfamilyName: 'Regular',
      preferredFamily: 'ABC Ginto Nord',
      preferredSubfamily: 'Black',
      postScriptName: 'ABCGintoNord-Black',
    })).toMatchObject({
      familyName: 'ABC Ginto Nord',
      styleName: 'Black',
      slug: 'abc-ginto-nord',
      fileBase: 'ABCGintoNord',
    });

    expect(resolveCanonicalFontIdentity({
      familyName: 'ABC Ginto Normal Black',
      subfamilyName: 'Regular',
      preferredFamily: 'ABC Ginto Normal',
      preferredSubfamily: 'Black',
      postScriptName: 'ABCGintoNormal-Black',
    })).toMatchObject({
      familyName: 'ABC Ginto Normal',
      styleName: 'Black',
      slug: 'abc-ginto-normal',
      fileBase: 'ABCGintoNormal',
    });
  });

  it('does not strip cut names like Normal when no typographic subfamily says they are styles', () => {
    expect(resolveCanonicalFontIdentity({
      familyName: 'ABC Ginto Normal',
      subfamilyName: 'Regular',
      postScriptName: 'ABCGintoNormal-Regular',
    })).toMatchObject({ familyName: 'ABC Ginto Normal', styleName: 'Regular', slug: 'abc-ginto-normal' });
  });

  it('keeps width descriptors in the face id to avoid overwriting styles', () => {
    const identity = resolveCanonicalFontIdentity({
      familyName: 'HD Colton Wide Black Italic',
      subfamilyName: 'Regular',
      preferredFamily: 'HD Colton',
      preferredSubfamily: 'Wide Black Italic',
      postScriptName: 'HDColton-WideBlackItalic',
    });

    expect(identity).toMatchObject({ familyName: 'HD Colton', styleName: 'Wide Black Italic', slug: 'hd-colton' });
    expect(canonicalFaceId(identity.styleName, false)).toBe('wide-black-italic');
  });

  it('repairs legacy family names that incorrectly include weight styles', () => {
    expect(resolveCanonicalFontIdentity({
      familyName: 'Aeonik Pro Light',
      subfamilyName: 'Regular',
      postScriptName: 'AeonikPro-Light',
    })).toMatchObject({ familyName: 'Aeonik Pro', styleName: 'Light', slug: 'aeonik-pro' });

    expect(resolveCanonicalFontIdentity({
      familyName: 'Aeonik Pro Black',
      subfamilyName: 'Regular Italic',
      postScriptName: 'AeonikPro-BlackItalic',
    })).toMatchObject({ familyName: 'Aeonik Pro', styleName: 'Black Italic', slug: 'aeonik-pro' });
  });

  it('strips weight suffixes while preserving display cuts', () => {
    expect(resolveCanonicalFontIdentity({
      familyName: 'Audacious Display Medium',
      subfamilyName: 'Regular',
      postScriptName: 'Audacious-DisplayMedium',
    })).toMatchObject({ familyName: 'Audacious Display', styleName: 'Medium', slug: 'audacious-display' });

    expect(resolveCanonicalFontIdentity({
      familyName: 'Audacious Display SemiBold',
      subfamilyName: 'Regular Italic',
      postScriptName: 'Audacious-DisplaySemiBoldItalic',
    })).toMatchObject({ familyName: 'Audacious Display', styleName: 'Semi Bold Italic', slug: 'audacious-display' });
  });

  it('trusts explicit typographic family metadata instead of guessing from words', () => {
    expect(resolveCanonicalFontIdentity({
      familyName: 'Audacious Black',
      subfamilyName: 'Regular',
      preferredFamily: 'Audacious Black',
      preferredSubfamily: 'Regular',
      postScriptName: 'Audacious-Black',
    })).toMatchObject({ familyName: 'Audacious Black', styleName: 'Regular', slug: 'audacious-black' });

    expect(resolveCanonicalFontIdentity({
      familyName: 'Audacious Display Medium',
      subfamilyName: 'Regular',
      preferredFamily: 'Audacious',
      preferredSubfamily: 'Display Medium',
      postScriptName: 'Audacious-DisplayMedium',
    })).toMatchObject({ familyName: 'Audacious', styleName: 'Display Medium', slug: 'audacious' });
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
