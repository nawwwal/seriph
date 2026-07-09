import { readSnapshot, writeSnapshot } from '@/lib/cache/persistentSnapshots';
import { parseSearchIndexResponse } from '@/lib/search/searchIndexCache';
import type { SearchIndexResponse } from '@/models/search.models';

const SEARCH_INDEX_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SEARCH_INDEX_KEY = 'current';

export async function readPersistentSearchIndex(accountId: string): Promise<SearchIndexResponse | null> {
  const record = await readSnapshot({ accountId, kind: 'search-index', key: SEARCH_INDEX_KEY });
  const index = record ? parseSearchIndexResponse(record.payload) : null;
  return index && record?.revision === index.libraryRevision ? index : null;
}

export async function writePersistentSearchIndex(accountId: string, index: SearchIndexResponse): Promise<void> {
  await writeSnapshot({
    accountId,
    kind: 'search-index',
    key: SEARCH_INDEX_KEY,
    payload: index,
    revision: index.libraryRevision,
    ttlMs: SEARCH_INDEX_TTL_MS,
    maxEntries: 1,
  });
}
