import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearAccountSnapshots } from '@/lib/cache/persistentSnapshots';
import { buildSemanticSearchCacheKey, readPersistentSemanticSearch, writePersistentSemanticSearch } from '@/lib/search/persistentSemanticSearch';
import type { SearchFilters, SearchResultItem } from '@/models/search.models';

const filters: SearchFilters = { classifications: [], moods: ['warm'], styleRanges: [], variable: 'any' };
const results: SearchResultItem[] = [{ id: 'ivar', slug: 'ivar', normalizedName: 'ivar', name: 'Ivar', category: 'Serif', classification: 'Serif', styleCount: 1, isVariable: false, updatedAt: '' }];

describe('persistent semantic search', () => {
  beforeEach(async () => clearAccountSnapshots({ accountId: 'ada' }));

  it('keys and returns semantic refinements by revision, normalized query, and filters', async () => {
    const key = buildSemanticSearchCacheKey({ libraryRevision: 4, query: '  Happy ', filters });
    await writePersistentSemanticSearch('ada', key, 4, results);

    expect(key).toContain('4:happy:');
    await expect(readPersistentSemanticSearch('ada', key)).resolves.toMatchObject([
      expect.objectContaining({ id: 'ivar', source: 'semantic' }),
    ]);
    await expect(readPersistentSemanticSearch('bea', key)).resolves.toBeNull();
  });
});
