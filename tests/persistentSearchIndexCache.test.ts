import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearAccountSnapshots } from '@/lib/cache/persistentSnapshots';
import { readPersistentSearchIndex, writePersistentSearchIndex } from '@/lib/search/persistentSearchIndexCache';
import { preferSearchIndex } from '@/lib/search/searchIndexSelection';
import type { SearchIndexResponse } from '@/models/search.models';

const index: SearchIndexResponse = {
  generatedAt: '2026-07-10T12:00:00.000Z',
  libraryRevision: 4,
  items: [{
    id: 'ivar', slug: 'ivar', normalizedName: 'ivar', name: 'Ivar', category: 'Serif', classification: 'Serif',
    styleCount: 1, isVariable: false, updatedAt: '2026-07-10T12:00:00.000Z', searchText: 'ivar serif', searchTokens: ['ivar', 'serif'],
  }],
};

describe('persistent search index cache', () => {
  beforeEach(async () => clearAccountSnapshots({ accountId: 'ada' }));

  it('returns a valid account-scoped search index snapshot', async () => {
    await writePersistentSearchIndex('ada', index);

    await expect(readPersistentSearchIndex('ada')).resolves.toEqual(index);
    await expect(readPersistentSearchIndex('bea')).resolves.toBeNull();
  });

  it('keeps the newest available index while IndexedDB hydrates', () => {
    expect(preferSearchIndex(index, { ...index, libraryRevision: 3 })).toEqual(index);
    expect(preferSearchIndex({ ...index, libraryRevision: 3 }, index)).toEqual(index);
  });
});
