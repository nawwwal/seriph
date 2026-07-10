import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearFamilyCacheForUser } from '@/lib/cache/familyCache';
import { clearFamilyDetailNegativeCacheForUser, loadFamilyDetail } from '@/lib/cache/familyDetailClient';
import { readPersistedFamilyDetail } from '@/lib/cache/familyDetailPersistence';
import { clearAccountSnapshots, writeSnapshot } from '@/lib/cache/persistentSnapshots';
import { failedFamilyResponse, rawFamily } from './fixtures/familyDetail';

const legacyRoute = 'legacy-inter';
const canonicalRoutes = ['inter', 'user-a__inter'];
const input = (uid: string, familyId: string) => ({ uid, familyId, getIdToken: async () => 'token' });

describe('pre-registry family detail snapshots', () => {
  beforeEach(async () => {
    for (const uid of ['user-a', 'user-b']) {
      clearFamilyCacheForUser(uid);
      clearFamilyDetailNegativeCacheForUser(uid);
      await clearAccountSnapshots({ accountId: uid });
    }
    vi.unstubAllGlobals();
  });

  it.each(canonicalRoutes)('evicts an unregistered alias after a %s 404 without another request', async (canonicalRoute) => {
    await writeSnapshot({
      accountId: 'user-a', kind: 'family-detail', key: legacyRoute, payload: rawFamily, ttlMs: 60_000,
    });
    await writeSnapshot({
      accountId: 'user-b', kind: 'family-detail', key: legacyRoute, payload: rawFamily, ttlMs: 60_000,
    });
    clearFamilyCacheForUser('user-a');
    const fetchMock = vi.fn(() => failedFamilyResponse(404, 'Family not found'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadFamilyDetail(input('user-a', canonicalRoute))).resolves.toEqual({ kind: 'not-found' });
    await expect(loadFamilyDetail(input('user-a', legacyRoute))).resolves.toEqual({ kind: 'not-found' });
    await expect(readPersistedFamilyDetail('user-a', legacyRoute)).resolves.toBeNull();
    await expect(readPersistedFamilyDetail('user-b', legacyRoute)).resolves.toMatchObject({ id: 'inter' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
