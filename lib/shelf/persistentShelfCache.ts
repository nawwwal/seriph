import { readSnapshot, writeSnapshot, invalidateSnapshots } from '@/lib/cache/persistentSnapshots';
import { parseShelfFamilyPage } from '@/lib/shelf/familyPageParsing';
import type { PaginatedFamiliesResponse } from '@/models/shelf.models';

const SHELF_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SHELF_KEY = 'root';

export async function readPersistentShelfCache(accountId: string): Promise<PaginatedFamiliesResponse | null> {
  const record = await readSnapshot({ accountId, kind: 'shelf', key: SHELF_KEY });
  return record ? parseShelfFamilyPage(record.payload) : null;
}

export async function writePersistentShelfCache(accountId: string, page: PaginatedFamiliesResponse): Promise<void> {
  await writeSnapshot({
    accountId,
    kind: 'shelf',
    key: SHELF_KEY,
    payload: page,
    revision: page.stats?.libraryRevision,
    ttlMs: SHELF_TTL_MS,
    maxEntries: 1,
  });
}

export async function clearPersistentShelfCache(accountId: string): Promise<void> {
  await invalidateSnapshots({ accountId, kind: 'shelf' });
}
