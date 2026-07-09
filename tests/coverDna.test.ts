import { describe, expect, it } from 'vitest';
import { deriveCoverDna, renderCoverSvgParts } from '@/lib/covers/coverDna';
import { getSampleChars } from '@/components/font/FamilyCoverArt';
import type { ShelfFamily } from '@/models/shelf.models';

function family(overrides: Partial<ShelfFamily> = {}): ShelfFamily {
  return {
    id: 'abc-ginto-nord',
    name: 'ABC Ginto Nord',
    normalizedName: 'abc-ginto-nord',
    classification: 'Sans Serif',
    styleCount: 4,
    isVariable: false,
    updatedAt: '2026-06-29T10:00:00.000Z',
    ...overrides,
  };
}

describe('cover DNA', () => {
  it('uses ABC for every catalog card classification', () => {
    expect(getSampleChars('Sans Serif')).toBe('ABC');
    expect(getSampleChars('Serif')).toBe('ABC');
    expect(getSampleChars('Unknown')).toBe('ABC');
  });

  it('is deterministic for the same family and cover seed', () => {
    expect(deriveCoverDna(family({ normalizedName: 'abc-ginto-nord' }), 0))
      .toEqual(deriveCoverDna(family({ normalizedName: 'abc-ginto-nord' }), 0));
  });

  it('changes its deterministic seed when the cover seed changes', () => {
    expect(deriveCoverDna(family({ normalizedName: 'abc-ginto-nord' }), 1).seed)
      .not.toBe(deriveCoverDna(family({ normalizedName: 'abc-ginto-nord' }), 0).seed);
  });

  it('ignores family metadata outside the normalized name', () => {
    const base = deriveCoverDna(family(), 0);
    const changed = deriveCoverDna(family({ id: 'other', name: 'Other', styleCount: 20, isVariable: true }), 0);
    expect(changed).toEqual(base);
  });

  it('produces bounded traits and non-empty svg parts', () => {
    const dna = deriveCoverDna(family(), 3);
    expect(dna.grammar).toBe('editorial-pattern');
    expect(dna.specimenX).toBe(16);
    expect(dna.specimenY).toBe(46);
    expect(dna.specimenScale).toBe(1);
    expect(dna.density).toBeGreaterThanOrEqual(0.44);
    expect(dna.density).toBeLessThanOrEqual(0.82);
    expect(dna.contrast).toBeGreaterThanOrEqual(0.16);
    expect(dna.contrast).toBeLessThanOrEqual(0.34);
    expect(dna.ruleWeight).toBeGreaterThanOrEqual(0.42);
    expect(dna.ruleWeight).toBeLessThanOrEqual(0.76);

    const parts = renderCoverSvgParts(dna);
    expect(parts.length).toBeGreaterThan(2);
    expect(parts.join('')).not.toMatch(/linearGradient|radialGradient|filter=|mask=|<image/);
  });

  it('distributes all six motif families across a shelf sample', () => {
    const sampleNames = [
      'ABC Ginto Nord',
      'Acid Grotesk',
      'BB Manual Mono Pro',
      'Century Gothic',
      'Forma DJR',
      'PP Radio Grotesk',
      'Satoshi',
      'Untitled Serif',
      'Aeonik Pro',
      'Apercu',
      'Basis Grotesque',
      'Canela',
      'Domaine Display',
      'Founders Grotesk',
      'GT America',
      'Neue Haas Unica',
      'Suisse Int\'l',
    ];
    const patterns = new Set(
      sampleNames.map((name) =>
        deriveCoverDna(
          family({
            name,
            normalizedName: name.toLowerCase(),
          }),
          0
        ).pattern
      )
    );

    expect(patterns.size).toBeGreaterThanOrEqual(6);
    expect(patterns).toEqual(new Set([
      'folded-facets',
      'concentric-portals',
      'ribbon-curves',
      'stepped-bands',
      'radial-bursts',
      'modular-dots-bars',
    ]));
  });
});
