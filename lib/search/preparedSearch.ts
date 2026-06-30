import type { SearchIndexItem } from '@/models/search.models';
import { normalizeSearchInput, searchTrigrams, uniqueSearchTokens } from '@/lib/search/searchText';

export interface PreparedSearchQuery {
  text: string;
  tokens: string[];
  grams: Set<string>;
  tokenGrams: Map<string, Set<string>>;
}

export interface PreparedSearchItem {
  item: SearchIndexItem;
  name: string;
  slug: string;
  primaryTokens: string[];
  primarySet: Set<string>;
  secondaryTokens: string[];
  secondarySet: Set<string>;
  allTokens: string[];
  allSet: Set<string>;
  nameGrams: Set<string>;
  slugGrams: Set<string>;
  tokenGrams: Map<string, Set<string>>;
}

const itemCache = new WeakMap<SearchIndexItem, PreparedSearchItem>();

function normalizedTokenList(tokens: string[]): string[] {
  return uniqueSearchTokens(tokens.join(' '));
}

function tokensForItem(item: SearchIndexItem, field: 'primary' | 'secondary' | 'all'): string[] {
  if (field === 'primary') {
    return uniqueSearchTokens(item.searchPrimaryText || [item.name, item.normalizedName, item.classification, ...(item.moods ?? [])].join(' '));
  }
  if (field === 'secondary') return uniqueSearchTokens(item.searchSecondaryText || item.summary || item.searchText);
  return item.searchTokens.length ? normalizedTokenList(item.searchTokens) : uniqueSearchTokens(item.searchText);
}

function tokenGramMap(tokens: string[]): Map<string, Set<string>> {
  const grams = new Map<string, Set<string>>();
  for (const token of tokens) grams.set(token, searchTrigrams(token));
  return grams;
}

export function prepareSearchQuery(query: string): PreparedSearchQuery | null {
  const text = normalizeSearchInput(query);
  if (!text) return null;
  const tokens = uniqueSearchTokens(text);
  return { text, tokens, grams: searchTrigrams(text), tokenGrams: tokenGramMap(tokens) };
}

export function prepareSearchItem(item: SearchIndexItem): PreparedSearchItem {
  const cached = itemCache.get(item);
  if (cached) return cached;
  const primaryTokens = tokensForItem(item, 'primary');
  const secondaryTokens = tokensForItem(item, 'secondary');
  const allTokens = tokensForItem(item, 'all');
  const prepared = {
    item,
    name: normalizeSearchInput(item.name),
    slug: normalizeSearchInput(item.slug),
    primaryTokens,
    primarySet: new Set(primaryTokens),
    secondaryTokens,
    secondarySet: new Set(secondaryTokens),
    allTokens,
    allSet: new Set(allTokens),
    nameGrams: searchTrigrams(item.name),
    slugGrams: searchTrigrams(item.slug),
    tokenGrams: tokenGramMap([...new Set([...primaryTokens, ...secondaryTokens])]),
  };
  itemCache.set(item, prepared);
  return prepared;
}
