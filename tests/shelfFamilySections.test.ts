import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ShelfFamilySections, { renderShelfFamilyGroups } from '@/components/home/ShelfFamilySections';
import { groupShelfFamilies } from '@/lib/shelf/groupShelfFamilies';
import { appendShelfFamilyPage } from '@/lib/shelf/familyPageCache';
import type { ShelfFamily } from '@/models/shelf.models';

vi.mock('@/components/home/ShelfFamilyGrid', () => ({ default: () => null }));

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
  it('preserves appended page order while assigning distinct keys to repeated labels', () => {
    const merged = appendShelfFamilyPage(
      { families: [family('f-current', 'Fraunces'), family('s-current', 'Satoshi')], nextCursor: 's-current', hasMore: true },
      { families: [family('f-cached', 'Figtree'), family('s-cached', 'Spline Sans')], nextCursor: null, hasMore: false }
    );
    const groups = groupShelfFamilies(merged.families);

    expect(groups.map((group) => group.label)).toEqual(['F', 'S', 'F', 'S']);
    expect(groups.map((group) => group.families[0]?.id)).toEqual(merged.families.map((item) => item.id));
    expect(new Set(groups.map((group) => group.key)).size).toBe(groups.length);
  });

  it('renders every ordered group with a distinct section identifier', () => {
    const families = [
      family('f-current', 'Fraunces'),
      family('s-current', 'Satoshi'),
      family('f-cached', 'Figtree'),
      family('s-cached', 'Spline Sans'),
    ];
    const markup = renderToStaticMarkup(createElement(ShelfFamilySections, {
      families,
      shelfMode: 'covers',
      coverSeed: 0,
      isRefreshing: false,
      selectionState: { mode: 'idle' },
      onOpenContextMenu: () => undefined,
    }));
    const sectionIds = Array.from(markup.matchAll(/aria-labelledby="([^"]+)"/g), (match) => match[1]);
    const labels = Array.from(markup.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g), (match) => match[1]);

    expect(labels).toEqual(['F', 'S', 'F', 'S']);
    expect(new Set(sectionIds).size).toBe(sectionIds.length);
  });

  it('uses the unique group key for every rendered section', () => {
    const groups = groupShelfFamilies([
      family('f-current', 'Fraunces'),
      family('s-current', 'Satoshi'),
      family('f-cached', 'Figtree'),
      family('s-cached', 'Spline Sans'),
    ]);
    const sections = renderShelfFamilyGroups({
      groups,
      shelfMode: 'covers',
      coverSeed: 0,
      isRefreshing: false,
      selectionState: { mode: 'idle' },
      onOpenContextMenu: () => undefined,
    });

    expect(sections.map((section) => section.key)).toEqual(groups.map((group) => group.key));
  });
});
