import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cacheFamilyById, clearFamilyCacheForUser } from '@/lib/cache/familyCache';
import {
  clearFamilyDetailNegativeCacheForUser,
  loadFamilyDetail,
  refreshFamilyDetail,
  serializeFamilyDetail,
} from '@/lib/cache/familyDetailClient';
import { readPersistedFamilyDetail } from '@/lib/cache/familyDetailPersistence';
import { clearAccountSnapshots } from '@/lib/cache/persistentSnapshots';
import { rawFamily } from './fixtures/familyDetail';
import { failedFamilyResponse } from './fixtures/familyDetail';

const userIds = ['user-a', 'user-b'];
const legacyRoute = 'legacy-aeonik';
const secondLegacyRoute = 'aeonik-legacy';
const canonicalRoute = 'aeonik-pro';

function detailResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => ({ data: {
      family: { ...rawFamily, id: 'aeonik', normalizedName: 'aeonik' },
      canonicalId: canonicalRoute,
    } }),
  };
}

describe('persisted family detail aliases', () => {
  beforeEach(async () => {
    for (const uid of userIds) {
      clearFamilyCacheForUser(uid);
      clearFamilyDetailNegativeCacheForUser(uid);
      await clearAccountSnapshots({ accountId: uid });
    }
    vi.unstubAllGlobals();
  });

  it('evicts every persisted alias after restart when a canonical refresh returns 404', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(detailResponse())
      .mockResolvedValueOnce(detailResponse())
      .mockResolvedValueOnce(detailResponse())
      .mockImplementationOnce(() => failedFamilyResponse(404, 'Family not found'));
    vi.stubGlobal('fetch', fetchMock);
    const input = (uid: string, familyId: string) => ({ uid, familyId, getIdToken: async () => 'token' });

    await loadFamilyDetail(input('user-a', legacyRoute));
    await loadFamilyDetail(input('user-a', secondLegacyRoute));
    await loadFamilyDetail(input('user-b', legacyRoute));
    clearFamilyCacheForUser('user-a');

    await expect(loadFamilyDetail(input('user-a', canonicalRoute))).resolves.toMatchObject({
      kind: 'loaded', source: 'snapshot',
    });
    await expect(refreshFamilyDetail(input('user-a', canonicalRoute))).resolves.toEqual({ kind: 'not-found' });
    const staleAlias = serializeFamilyDetail({ ...rawFamily, id: 'aeonik', normalizedName: 'aeonik' });
    if (!staleAlias) throw new Error('Expected valid stale family fixture');
    cacheFamilyById('user-a', legacyRoute, staleAlias);
    await expect(loadFamilyDetail(input('user-a', legacyRoute))).resolves.toEqual({ kind: 'not-found' });
    await expect(loadFamilyDetail(input('user-a', secondLegacyRoute))).resolves.toEqual({ kind: 'not-found' });
    await expect(readPersistedFamilyDetail('user-a', legacyRoute)).resolves.toBeNull();
    await expect(readPersistedFamilyDetail('user-a', secondLegacyRoute)).resolves.toBeNull();
    await expect(readPersistedFamilyDetail('user-a', canonicalRoute)).resolves.toBeNull();
    clearFamilyCacheForUser('user-b');
    await expect(loadFamilyDetail(input('user-b', legacyRoute))).resolves.toMatchObject({
      kind: 'loaded', source: 'snapshot',
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
