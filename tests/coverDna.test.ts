import { describe, expect, it } from 'vitest';
import { deriveCoverDna, renderCoverSvgParts } from '@/lib/covers/coverDna';
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
  it('is deterministic for the same family and cover seed', () => {
    expect(deriveCoverDna(family(), 0)).toEqual(deriveCoverDna(family(), 0));
  });

  it('varies visibly across related family names', () => {
    const base = deriveCoverDna(family({ id: 'abc-ginto-nord', name: 'ABC Ginto Nord' }), 0);
    const black = deriveCoverDna(family({ id: 'abc-ginto-nord-black', name: 'ABC Ginto Nord Black' }), 0);
    const hairline = deriveCoverDna(family({ id: 'abc-ginto-nord-hairline', name: 'ABC Ginto Nord Hairline', styleCount: 2 }), 0);

    const signatures = new Set([base, black, hairline].map((dna) => `${dna.pattern}:${dna.angle}:${dna.rhythm.join(':')}`));
    expect(signatures.size).toBe(3);
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
    expect(parts.join('')).not.toMatch(/wave|moire|lissajous|nodal|mask="url/);
  });

  it('distributes editorial patterns across a shelf sample', () => {
    const names = [
      'ABC Ginto Nord',
      'Acid Grotesk',
      'BB Manual Mono Pro',
      'Century Gothic',
      'Forma DJR',
      'PP Radio Grotesk',
      'Satoshi',
      'Untitled Serif',
    ];
    const patterns = new Set(
      names.map((name) =>
        deriveCoverDna(
          family({
            id: name.toLowerCase().replaceAll(' ', '-'),
            name,
            normalizedName: name.toLowerCase().replaceAll(' ', '-'),
          }),
          0
        ).pattern
      )
    );

    expect(patterns.size).toBeGreaterThanOrEqual(2);
  });
});
