import { describe, expect, it } from 'vitest';
import { buildLocalSearchView, buildSearchRefinementState } from '@/lib/search/searchView';
import type { SearchIndexItem, SearchResultItem } from '@/models/search.models';

const technicalMonoItems: SearchIndexItem[] = [
  { id: 'mono-one', slug: 'mono-one', normalizedName: 'mono-one', name: 'Technical Mono One', category: 'MONOSPACE', classification: 'Monospace', styleCount: 4, isVariable: true, updatedAt: '', moods: ['technical'], searchText: 'technical mono one', searchTokens: ['technical', 'mono', 'one'] },
  { id: 'mono-two', slug: 'mono-two', normalizedName: 'mono-two', name: 'Technical Mono Two', category: 'MONOSPACE', classification: 'Monospace', styleCount: 6, isVariable: true, updatedAt: '', moods: ['technical'], searchText: 'technical mono two', searchTokens: ['technical', 'mono', 'two'] },
  { id: 'mono-three', slug: 'mono-three', normalizedName: 'mono-three', name: 'Technical Mono Three', category: 'MONOSPACE', classification: 'Monospace', styleCount: 8, isVariable: true, updatedAt: '', moods: ['technical'], searchText: 'technical mono three', searchTokens: ['technical', 'mono', 'three'] },
  { id: 'mono-static', slug: 'mono-static', normalizedName: 'mono-static', name: 'Technical Mono Static', category: 'MONOSPACE', classification: 'Monospace', styleCount: 3, isVariable: false, updatedAt: '', moods: ['technical'], searchText: 'technical mono static', searchTokens: ['technical', 'mono', 'static'] },
];

describe('buildSearchRefinementState', () => {
  it('retains variable local candidates while the matching semantic search refines', () => {
    const localView = buildLocalSearchView(technicalMonoItems, 'technical mono', {
      classifications: [],
      moods: [],
      styleRanges: [],
      variable: 'variable',
    });

    const state = buildSearchRefinementState({
      query: 'technical mono',
      localView,
      semanticResults: [],
      isRefining: true,
      hasCurrentSemanticResult: true,
    });

    expect(state.results.map((item) => item.id)).toEqual(['mono-one', 'mono-three', 'mono-two']);
    expect(state.isRefining).toBe(true);
    expect(state.resultPresentation).toBe('matches');
  });

  it('marks a semantic fallback without local matches as suggestions', () => {
    const localView = buildLocalSearchView(technicalMonoItems, 'unfindable display face', {
      classifications: [],
      moods: [],
      styleRanges: [],
      variable: 'any',
    });
    const semanticFallback: SearchResultItem[] = [{ ...technicalMonoItems[0], source: 'semantic' }];

    const state = buildSearchRefinementState({
      query: 'unfindable display face',
      localView,
      semanticResults: semanticFallback,
      isRefining: false,
      hasCurrentSemanticResult: true,
    });

    expect(localView.results).toEqual([]);
    expect(state.results.map((item) => item.id)).toEqual(['mono-one']);
    expect(state.resultPresentation).toBe('suggestions');
  });

  it('does not replace current local candidates with a stale semantic tuple', () => {
    const localView = buildLocalSearchView(technicalMonoItems, 'technical mono', {
      classifications: [],
      moods: [],
      styleRanges: [],
      variable: 'variable',
    });
    const staleSemanticResults: SearchResultItem[] = [{ ...technicalMonoItems[3], source: 'semantic' }];

    const state = buildSearchRefinementState({
      query: 'technical mono',
      localView,
      semanticResults: staleSemanticResults,
      isRefining: false,
      hasCurrentSemanticResult: false,
    });

    expect(state.results.map((item) => item.id)).toEqual(['mono-one', 'mono-three', 'mono-two']);
    expect(state.resultPresentation).toBe('matches');
  });
});
