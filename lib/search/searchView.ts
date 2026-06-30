import { rankLocalSearch } from '@/lib/search/localSearch';
import { buildSearchFacets, filterSearchResults } from '@/lib/search/searchFilters';
import type { SearchFacets, SearchFilters, SearchIndexItem, SearchResultItem } from '@/models/search.models';

interface LocalSearchView {
  facets: SearchFacets;
  resultCount: number;
  results: SearchResultItem[];
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
