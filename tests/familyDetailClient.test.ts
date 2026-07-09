import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAccountSnapshots, writeSnapshot } from '@/lib/cache/persistentSnapshots';
import { clearFamilyCacheForUser, getCachedFamily } from '@/lib/cache/familyCache';
import { loadFamilyDetail, serializeFamilyDetail } from '@/lib/cache/familyDetailClient';
import { rawFamily, successfulFamilyResponse } from './fixtures/familyDetail';

function mockFamilyFetch() {
  return vi.fn(successfulFamilyResponse);
}

describe('family detail client loader', () => {
  beforeEach(async () => {
    clearFamilyCacheForUser('user-a');
    await clearAccountSnapshots({ accountId: 'user-a' });
    vi.unstubAllGlobals();
  });

  it('dedupes concurrent requests for the same user and family', async () => {
    const fetchMock = mockFamilyFetch();
    vi.stubGlobal('fetch', fetchMock);
    const getIdToken = vi.fn(async () => 'token');
    const input = { uid: 'user-a', familyId: 'inter', getIdToken };

    const first = loadFamilyDetail(input);
    const second = loadFamilyDetail(input);

    expect(first).toBe(second);
    await expect(first).resolves.toMatchObject({
      kind: 'loaded',
      family: { id: 'inter', name: 'Inter' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getIdToken).toHaveBeenCalledTimes(1);
    expect(getCachedFamily('user-a', 'inter')?.name).toBe('Inter');
  });

  it('serves cached detail without another network request', async () => {
    const fetchMock = mockFamilyFetch();
    vi.stubGlobal('fetch', fetchMock);
    await loadFamilyDetail({ uid: 'user-a', familyId: 'inter', getIdToken: async () => 'token' });
    fetchMock.mockClear();

    await expect(loadFamilyDetail({ uid: 'user-a', familyId: 'inter', getIdToken: async () => 'token' }))
      .resolves.toMatchObject({ kind: 'loaded', family: { id: 'inter' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('hydrates an account-scoped persisted detail before making a network request', async () => {
    await writeSnapshot({ accountId: 'user-a', kind: 'family-detail', key: 'inter', payload: rawFamily, ttlMs: 60_000 });
    const fetchMock = mockFamilyFetch();
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadFamilyDetail({ uid: 'user-a', familyId: 'inter', getIdToken: async () => 'token' }))
      .resolves.toMatchObject({ kind: 'loaded', family: { id: 'inter' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('caches returned details under the requested route id when it differs from the canonical id', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          family: { ...rawFamily, id: 'canonical-inter' },
          canonicalId: 'canonical-inter-v2',
        },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await loadFamilyDetail({ uid: 'user-a', familyId: 'inter', getIdToken: async () => 'token' });

    expect(getCachedFamily('user-a', 'inter')?.id).toBe('canonical-inter');
    expect(getCachedFamily('user-a', 'canonical-inter')?.id).toBe('canonical-inter');
    expect(getCachedFamily('user-a', 'canonical-inter-v2')?.id).toBe('canonical-inter');
    expect(getCachedFamily('user-b', 'inter')).toBeUndefined();
  });

  it('normalizes missing dates and clones font arrays', () => {
    const serialized = serializeFamilyDetail({ ...rawFamily, uploadDate: null, fonts: rawFamily.fonts });

    expect(serialized?.uploadDate).toBe('');
    expect(serialized?.fonts).toEqual(rawFamily.fonts);
    expect(serialized?.fonts).not.toBe(rawFamily.fonts);
  });
});
