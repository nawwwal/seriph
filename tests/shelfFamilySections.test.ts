import { describe, expect, it } from 'vitest';
import { groupShelfFamilies } from '@/lib/shelf/groupShelfFamilies';
import type { ShelfFamily } from '@/models/shelf.models';

function family(id: string, name: string): ShelfFamily {
  return {
    id,
    name,
    normalizedName: id,
    classification: 'Sans Serif',
    styleCount: 1,
    isVariable: false,
    updatedAt: '2026-07-10T00:00:00.000Z',
  };
}

describe('groupShelfFamilies', () => {
  it('coalesces repeated labels from cached and appended pages into one section', () => {
    const groups = groupShelfFamilies([
      family('f-current', 'Fraunces'),
      family('s-current', 'Satoshi'),
      family('f-cached', 'Figtree'),
      family('s-cached', 'Spline Sans'),
    ]);

    expect(groups.map((group) => group.label)).toEqual(['F', 'S']);
    expect(groups[0]?.families.map((item) => item.id)).toEqual(['f-current', 'f-cached']);
    expect(groups[1]?.families.map((item) => item.id)).toEqual(['s-current', 's-cached']);
  });
});
