import { describe, expect, it } from 'vitest';
import {
  applyShelfFilters,
  deriveShelfMoods,
  emptyShelfFilters,
  toggleFilterValue,
} from '@/components/home/shelfFilters';
import type { SearchIndexItem } from '@/models/search.models';
import type { ShelfFamily } from '@/models/shelf.models';

const families: ShelfFamily[] = [
  {
    id: 'sans-a',
    name: 'Atlas',
    normalizedName: 'atlas',
    classification: 'Sans Serif',
    styleCount: 4,
    isVariable: true,
    updatedAt: '2026-01-01',
  },
  {
    id: 'serif-b',
    name: 'Bodoni',
    normalizedName: 'bodoni',
    classification: 'Serif',
    styleCount: 2,
    isVariable: false,
    updatedAt: '2026-01-02',
  },
];

const index = new Map<string, SearchIndexItem>([
  ['sans-a', {
    id: 'sans-a',
    slug: 'atlas',
    name: 'Atlas',
    normalizedName: 'atlas',
    category: 'SANS_SERIF',
    classification: 'Sans Serif',
    moods: ['neutral', 'modern'],
    styleCount: 4,
    isVariable: true,
    updatedAt: '2026-01-01',
    searchText: 'atlas neutral modern',
    searchTokens: ['atlas', 'neutral', 'modern'],
  }],
  ['serif-b', {
    id: 'serif-b',
    slug: 'bodoni',
    name: 'Bodoni',
    normalizedName: 'bodoni',
    category: 'SERIF',
    classification: 'Serif',
    moods: ['editorial'],
    styleCount: 2,
    isVariable: false,
    updatedAt: '2026-01-02',
    searchText: 'bodoni editorial',
    searchTokens: ['bodoni', 'editorial'],
  }],
]);

describe('shelfFilters', () => {
  it('toggles multi-select values', () => {
    expect(toggleFilterValue(['Serif'], 'Serif')).toEqual([]);
    expect(toggleFilterValue([], 'Serif')).toEqual(['Serif']);
  });

  it('filters by classification and variable flag', () => {
    const result = applyShelfFilters(families, {
      ...emptyShelfFilters,
      classifications: ['Sans Serif'],
      builds: ['variable'],
    }, index);
    expect(result.map((family) => family.id)).toEqual(['sans-a']);
  });

  it('filters by mood using the search index', () => {
    const result = applyShelfFilters(families, {
      ...emptyShelfFilters,
      moods: ['editorial'],
    }, index);
    expect(result.map((family) => family.id)).toEqual(['serif-b']);
  });

  it('derives top moods by frequency', () => {
    expect(deriveShelfMoods([...index.values()])).toEqual(
      expect.arrayContaining(['editorial', 'modern', 'neutral']),
    );
  });
});
