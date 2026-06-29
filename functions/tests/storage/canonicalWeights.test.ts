import { describe, expect, it } from 'vitest';
import {
  familyFileBase,
  familySlug,
  parseStyle,
  snapWeight,
  weightNameFromNumber,
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

  it('prefers a recognized name token over substring order', () => {
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
