import { readSnapshot, writeSnapshot } from '@/lib/cache/persistentSnapshots';
import { normalizeSearchInput } from '@/lib/search/localSearch';
import { normalizeSearchResult } from '@/lib/search/searchApiParsing';
import { searchFiltersKey } from '@/lib/search/searchFilterUrl';
import type { SearchFilters, SearchResultItem } from '@/models/search.models';

const SEMANTIC_TTL_MS = 15 * 60 * 1000;
const SEMANTIC_MAX_ENTRIES = 20;

export function buildSemanticSearchCacheKey(input: { libraryRevision: number; query: string; filters: SearchFilters }): string {
  return `${input.libraryRevision}:${normalizeSearchInput(input.query)}:${searchFiltersKey(input.filters)}`;
}

export async function readPersistentSemanticSearch(accountId: string, key: string): Promise<SearchResultItem[] | null> {
  const record = await readSnapshot({ accountId, kind: 'semantic-search', key });
  if (!record || !Array.isArray(record.payload)) return null;
  const results = record.payload.map(normalizeSearchResult).filter((item): item is SearchResultItem => item !== null);
  return results.length === record.payload.length ? results : null;
}

export async function writePersistentSemanticSearch(accountId: string, key: string, revision: number, results: SearchResultItem[]): Promise<void> {
  await writeSnapshot({ accountId, kind: 'semantic-search', key, payload: results, revision, ttlMs: SEMANTIC_TTL_MS, maxEntries: SEMANTIC_MAX_ENTRIES });
}
