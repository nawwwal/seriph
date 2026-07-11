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
  it('is deterministic', () => {
    expect(deriveCoverDna(family(), 0)).toEqual(deriveCoverDna(family(), 0));
    const dna = deriveCoverDna(family(), 2);
    expect(renderCoverSvgParts(dna)).toEqual(renderCoverSvgParts(dna));
  });

  it('varies across names', () => {
    const sigs = new Set(
      ['ABC Ginto Nord', 'Acid Grotesk', 'Satoshi', 'Recoleta', 'Clash Display'].map((name) => {
        const d = deriveCoverDna(family({ name, id: name, normalizedName: name }), 0);
        return `${d.pattern}:${d.angle}`;
      })
    );
    expect(sigs.size).toBeGreaterThanOrEqual(3);
  });

  it('renders hard ink geometry only', () => {
    const dna = deriveCoverDna(family(), 3);
    expect(dna.grammar).toBe('swiss-poster');
    const svg = renderCoverSvgParts(dna).join('');
    expect(svg.length).toBeGreaterThan(20);
    expect(svg).toMatch(/currentColor/);
    expect(svg).not.toMatch(/feGaussianBlur|radialGradient/);
    expect(svg).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(/);
  });

  it('reshuffles with coverSeed', () => {
    expect(deriveCoverDna(family(), 0).seed).not.toBe(deriveCoverDna(family(), 9).seed);
  });
});
