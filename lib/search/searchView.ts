import { mergeSearchResults, rankLocalSearch } from '@/lib/search/localSearch';
import { buildSearchFacets, filterSearchResults } from '@/lib/search/searchFilters';
import type { SearchFacets, SearchFilters, SearchIndexItem, SearchResultItem } from '@/models/search.models';

export type SearchResultPresentation = 'matches' | 'suggestions';

export interface LocalSearchView {
  facets: SearchFacets;
  resultCount: number;
  results: SearchResultItem[];
}

interface SearchRefinementStateInput {
  query: string;
  localView: LocalSearchView;
  semanticResults: SearchResultItem[];
  isRefining: boolean;
  hasCurrentSemanticResult: boolean;
}

export interface SearchRefinementState {
  results: SearchResultItem[];
  isRefining: boolean;
  resultPresentation: SearchResultPresentation;
}

function asLocalResult(item: SearchIndexItem): SearchResultItem {
  return { ...item, source: 'local' };
}

export function buildLocalSearchView(
  items: SearchIndexItem[],
  query: string,
  filters: SearchFilters,
  limit = 24
): LocalSearchView {
  const hasQuery = query.trim().length > 0;
  if (hasQuery) {
    const candidates = rankLocalSearch(items, query, Number.POSITIVE_INFINITY);
    const filtered = filterSearchResults(candidates, filters);
    return { facets: buildSearchFacets(candidates, filters), resultCount: filtered.length, results: filtered.slice(0, limit) };
  }
  const filtered = filterSearchResults(items, filters);
  return { facets: buildSearchFacets(items, filters), resultCount: filtered.length, results: filtered.slice(0, limit).map(asLocalResult) };
}

export function buildSearchRefinementState({
  query,
  localView,
  semanticResults,
  isRefining,
  hasCurrentSemanticResult,
}: SearchRefinementStateInput): SearchRefinementState {
  const canUseSemanticResults = query.trim().length > 0 && hasCurrentSemanticResult && !isRefining;
  const results = canUseSemanticResults ? mergeSearchResults(semanticResults, localView.results) : localView.results;
  const resultPresentation: SearchResultPresentation = localView.resultCount === 0 && results.length > 0 ? 'suggestions' : 'matches';
  return { results, isRefining, resultPresentation };
}
