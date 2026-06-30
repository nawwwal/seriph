import { emptySearchFilters } from '@/lib/search/searchFilters';
import type { SearchFilters, SearchStyleRange, SearchVariableFilter } from '@/models/search.models';

const styleValues = new Set<SearchStyleRange>(['1', '2-4', '5-8', '9+']);
const variableValues = new Set<SearchVariableFilter>(['any', 'variable', 'static']);

function values(params: URLSearchParams, key: string): string[] {
  return params.getAll(key).flatMap((value) => value.split(',')).map((value) => value.trim()).filter(Boolean);
}

export function parseSearchFilters(params: URLSearchParams): SearchFilters {
  const variable = params.get('variable') ?? 'any';
  return {
    classifications: values(params, 'classification'),
    moods: values(params, 'mood'),
    styleRanges: values(params, 'styles').filter((value): value is SearchStyleRange => styleValues.has(value as SearchStyleRange)),
    variable: variableValues.has(variable as SearchVariableFilter) ? variable as SearchVariableFilter : 'any',
  };
}

export function sameSearchFilters(left: SearchFilters, right: SearchFilters): boolean {
  return left.variable === right.variable
    && left.classifications.join('\0') === right.classifications.join('\0')
    && left.moods.join('\0') === right.moods.join('\0')
    && left.styleRanges.join('\0') === right.styleRanges.join('\0');
}

export function searchFiltersKey(filters: SearchFilters): string {
  return JSON.stringify(filters);
}

export function searchHref(query: string, filters: SearchFilters = emptySearchFilters): string {
  const params = new URLSearchParams();
  const trimmed = query.trim();
  if (trimmed) params.set('q', trimmed);
  for (const value of filters.classifications) params.append('classification', value);
  for (const value of filters.moods) params.append('mood', value);
  for (const value of filters.styleRanges) params.append('styles', value);
  if (filters.variable !== 'any') params.set('variable', filters.variable);
  const text = params.toString();
  return text ? `/search?${text}` : '/search';
}
