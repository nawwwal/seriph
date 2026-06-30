import type { SearchFacetOption, SearchFacets, SearchFilters, SearchResultItem, SearchStyleRange } from '@/models/search.models';

export const emptySearchFilters: SearchFilters = { classifications: [], moods: [], styleRanges: [], variable: 'any' };

const styleRanges: Record<SearchStyleRange, { label: string; min: number; max: number }> = {
  '1': { label: 'Single', min: 1, max: 1 },
  '2-4': { label: '2-4 styles', min: 2, max: 4 },
  '5-8': { label: '5-8 styles', min: 5, max: 8 },
  '9+': { label: '9+ styles', min: 9, max: Number.POSITIVE_INFINITY },
};

function inStyleRanges(count: number, ranges: SearchStyleRange[]): boolean {
  return !ranges.length || ranges.some((range) => count >= styleRanges[range].min && count <= styleRanges[range].max);
}

export function hasSearchFilters(filters: SearchFilters): boolean {
  return filters.variable !== 'any' || filters.classifications.length > 0 || filters.moods.length > 0 || filters.styleRanges.length > 0;
}

export function matchesSearchFilters(item: SearchResultItem, filters: SearchFilters): boolean {
  if (filters.variable === 'variable' && !item.isVariable) return false;
  if (filters.variable === 'static' && item.isVariable) return false;
  if (filters.classifications.length && !filters.classifications.includes(item.classification)) return false;
  if (filters.moods.length && !filters.moods.every((mood) => item.moods?.includes(mood))) return false;
  return inStyleRanges(item.styleCount, filters.styleRanges);
}

function countedOptions(values: string[], selected: string[] = [], limit = 10): SearchFacetOption[] {
  const counts = new Map<string, number>();
  for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, Math.max(limit, selected.length))
    .map(([value, count]) => ({ value, label: value, count }));
}

export function buildSearchFacets(items: SearchResultItem[], filters: SearchFilters): SearchFacets {
  const classificationBase = items.filter((item) => matchesSearchFilters(item, { ...filters, classifications: [] }));
  const moodBase = items.filter((item) => matchesSearchFilters(item, { ...filters, moods: [] }));
  const styleBase = items.filter((item) => matchesSearchFilters(item, { ...filters, styleRanges: [] }));
  const variableBase = items.filter((item) => matchesSearchFilters(item, { ...filters, variable: 'any' }));

  return {
    classifications: countedOptions(classificationBase.map((item) => item.classification), filters.classifications, 8),
    moods: countedOptions(moodBase.flatMap((item) => item.moods ?? []), filters.moods, 12),
    styleRanges: Object.entries(styleRanges).map(([value, range]) => ({
      value,
      label: range.label,
      count: styleBase.filter((item) => inStyleRanges(item.styleCount, [value as SearchStyleRange])).length,
    })),
    variable: [
      { value: 'variable', label: 'Variable', count: variableBase.filter((item) => item.isVariable).length },
      { value: 'static', label: 'Static', count: variableBase.filter((item) => !item.isVariable).length },
    ],
  };
}

export function filterSearchResults<T extends SearchResultItem>(items: T[], filters: SearchFilters): T[] {
  return hasSearchFilters(filters) ? items.filter((item) => matchesSearchFilters(item, filters)) : items;
}
