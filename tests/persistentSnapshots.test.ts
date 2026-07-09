import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearAccountSnapshots,
  invalidateSnapshots,
  readSnapshot,
  writeSnapshot,
} from '@/lib/cache/persistentSnapshots';

const scope = { kind: 'shelf' as const, key: 'root' };

describe('persistent snapshots', () => {
  beforeEach(async () => {
    await Promise.all(['ada', 'bea'].map((accountId) => clearAccountSnapshots({ accountId })));
  });

  it('returns a fresh snapshot only to the owning account', async () => {
    await writeSnapshot({ accountId: 'ada', ...scope, payload: { families: ['A'] }, revision: 4, ttlMs: 60_000 });

    await expect(readSnapshot({ accountId: 'ada', ...scope }))
      .resolves.toMatchObject({ payload: { families: ['A'] }, revision: 4 });
    await expect(readSnapshot({ accountId: 'bea', ...scope })).resolves.toBeNull();
  });

  it('removes expired records before returning them', async () => {
    await writeSnapshot({ accountId: 'ada', ...scope, payload: { families: [] }, ttlMs: -1 });

    await expect(readSnapshot({ accountId: 'ada', ...scope })).resolves.toBeNull();
  });

  it('evicts the oldest records within one account and kind', async () => {
    await writeSnapshot({ accountId: 'ada', kind: 'family-detail', key: 'a', payload: 'a', ttlMs: 60_000, maxEntries: 2 });
    await writeSnapshot({ accountId: 'ada', kind: 'family-detail', key: 'b', payload: 'b', ttlMs: 60_000, maxEntries: 2 });
    await writeSnapshot({ accountId: 'ada', kind: 'family-detail', key: 'c', payload: 'c', ttlMs: 60_000, maxEntries: 2 });

    await expect(readSnapshot({ accountId: 'ada', kind: 'family-detail', key: 'a' })).resolves.toBeNull();
    await expect(readSnapshot({ accountId: 'ada', kind: 'family-detail', key: 'b' })).resolves.toMatchObject({ payload: 'b' });
    await expect(readSnapshot({ accountId: 'ada', kind: 'family-detail', key: 'c' })).resolves.toMatchObject({ payload: 'c' });
  });

  it('invalidates one kind without clearing other account snapshots', async () => {
    await writeSnapshot({ accountId: 'ada', ...scope, payload: 'shelf', ttlMs: 60_000 });
    await writeSnapshot({ accountId: 'ada', kind: 'search-index', key: 'current', payload: 'index', ttlMs: 60_000 });
    await invalidateSnapshots({ accountId: 'ada', kind: 'shelf' });

    await expect(readSnapshot({ accountId: 'ada', ...scope })).resolves.toBeNull();
    await expect(readSnapshot({ accountId: 'ada', kind: 'search-index', key: 'current' })).resolves.toMatchObject({ payload: 'index' });
  });
});
