import { describe, expect, it } from 'vitest';
import {
  appendShelfFamilyPage,
  mergeShelfRefreshPage,
  parseShelfFamilyPage,
  parseShelfStats,
} from '@/lib/shelf/familyPageCache';
import type { ShelfFamily, ShelfStatsSummary } from '@/models/shelf.models';

const stats: ShelfStatsSummary = {
  familyCount: 1198,
  styleCount: 1898,
  recentFamilyName: 'Satoshi',
  generatedAt: '2026-06-30T12:00:00.000Z',
};

const shelfFamily = (id: string, name: string): ShelfFamily => ({
  id,
  name,
  normalizedName: id,
  classification: 'Sans Serif',
  styleCount: 1,
  isVariable: false,
  updatedAt: '2026-06-30T12:00:00.000Z',
});

describe('shelf page cache helpers', () => {
  it('parses stable shelf stats separately from paginated families', () => {
    expect(parseShelfStats(stats)).toEqual(stats);
    expect(parseShelfStats({ ...stats, styleCount: '1898' })).toBeNull();
    expect(parseShelfFamilyPage({ families: [], hasMore: false, nextCursor: null, stats })?.stats).toEqual(stats);
  });

  it('appends loaded pages into one cached shelf view without duplicates', () => {
    const merged = appendShelfFamilyPage(
      { families: [shelfFamily('a', 'Aeonik'), shelfFamily('b', 'Benton')], nextCursor: 'b', hasMore: true },
      { families: [shelfFamily('b', 'Benton'), shelfFamily('c', 'Canela')], nextCursor: 'c', hasMore: true }
    );

    expect(merged.families.map((family) => family.id)).toEqual(['a', 'b', 'c']);
    expect(merged.nextCursor).toBe('c');
    expect(merged.hasMore).toBe(true);
  });

  it('does not keep stale cached families when the first page refreshes', () => {
    const refreshed = mergeShelfRefreshPage(
      { families: [shelfFamily('old-a', 'Old A'), shelfFamily('b', 'Benton'), shelfFamily('c', 'Canela')], nextCursor: 'c', hasMore: true, stats },
      { families: [shelfFamily('a', 'Aeonik'), shelfFamily('b', 'Benton')], nextCursor: 'b', hasMore: true }
    );

    expect(refreshed.families.map((family) => family.id)).toEqual(['a', 'b']);
    expect(refreshed.nextCursor).toBe('b');
    expect(refreshed.stats).toEqual(stats);
  });
});
