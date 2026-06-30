import { describe, expect, it } from 'vitest';
import { rankLocalSearch } from '@/lib/search/localSearch';
import { buildSearchFacets, filterSearchResults } from '@/lib/search/searchFilters';
import { buildLocalSearchView } from '@/lib/search/searchView';

const items = [
  { id: 'ivar', slug: 'ivar', normalizedName: 'ivar', name: 'Ivar Text', category: 'SERIF', classification: 'Serif' as const, styleCount: 4, isVariable: false, updatedAt: '', moods: ['editorial', 'warm'], searchText: 'ivar text editorial serif', searchTokens: ['ivar', 'editorial', 'serif'] },
  { id: 'aeonik', slug: 'aeonik', normalizedName: 'aeonik', name: 'Aeonik Pro', category: 'SANS_SERIF', classification: 'Sans Serif' as const, styleCount: 8, isVariable: true, updatedAt: '', moods: ['geometric', 'clean'], searchText: 'aeonik geometric sans', searchTokens: ['aeonik', 'geometric', 'sans'] },
];

describe('rankLocalSearch', () => {
  it('ranks exact and prefix matches immediately from the local index', () => {
    const results = rankLocalSearch(items, 'iva');

    expect(results[0]?.id).toBe('ivar');
    expect(results[0]?.source).toBe('local');
  });

  it('prefers primary mood/name signals over broad secondary text matches', () => {
    const results = rankLocalSearch([
      { id: 'generic', slug: 'generic', normalizedName: 'generic', name: 'Generic Sans', category: 'SANS_SERIF', classification: 'Sans Serif', styleCount: 1, isVariable: false, updatedAt: '', searchText: 'generic sans editorial layout', searchPrimaryText: 'generic sans modern', searchSecondaryText: 'editorial layout', searchTokens: ['generic', 'sans', 'editorial', 'layout'] },
      { ...items[0], searchPrimaryText: 'ivar text serif editorial', searchSecondaryText: '' },
    ], 'editorial');

    expect(results[0]?.id).toBe('ivar');
  });
});

describe('search filters and facets', () => {
  it('filters results by classification, mood, style range, and variable state', () => {
    expect(filterSearchResults(items, {
      classifications: ['Sans Serif'],
      moods: ['geometric'],
      styleRanges: ['5-8'],
      variable: 'variable',
    }).map((item) => item.id)).toEqual(['aeonik']);
  });

  it('builds facet counts from the current index', () => {
    const facets = buildSearchFacets(items, { classifications: [], moods: [], styleRanges: [], variable: 'any' });

    expect(facets.classifications.map((facet) => [facet.value, facet.count])).toContainEqual(['Serif', 1]);
    expect(facets.moods.map((facet) => facet.value)).toContain('geometric');
    expect(facets.variable.find((facet) => facet.value === 'variable')?.count).toBe(1);
  });

  it('scopes facet counts to the active query candidate set', () => {
    const view = buildLocalSearchView(items, 'ivar', { classifications: [], moods: [], styleRanges: [], variable: 'any' });

    expect(view.resultCount).toBe(1);
    expect(view.results.map((item) => item.id)).toEqual(['ivar']);
    expect(view.facets.classifications.map((facet) => [facet.value, facet.count])).toEqual([['Serif', 1]]);
    expect(view.facets.moods.map((facet) => [facet.value, facet.count])).toEqual([['editorial', 1], ['warm', 1]]);
    expect(view.facets.variable.find((facet) => facet.value === 'variable')?.count).toBe(0);
  });
});
