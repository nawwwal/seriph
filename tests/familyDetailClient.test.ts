import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearFamilyCacheForUser, getCachedFamily } from '@/lib/cache/familyCache';
import { loadFamilyDetail, serializeFamilyDetail } from '@/lib/cache/familyDetailClient';

const rawFamily = {
  id: 'inter',
  name: 'Inter',
  normalizedName: 'inter',
  description: '',
  tags: [],
  classification: 'Sans Serif',
  metadata: {},
  fonts: [{ id: 'regular', subfamily: 'Regular', weight: 400, metadata: {} }],
  uploadDate: '2026-07-01T00:00:00.000Z',
  lastModified: '2026-07-01T00:00:00.000Z',
};

function mockFamilyFetch() {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ data: { family: rawFamily } }),
  }));
}

describe('family detail client loader', () => {
  beforeEach(() => {
    clearFamilyCacheForUser('user-a');
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
    await expect(first).resolves.toMatchObject({ id: 'inter', name: 'Inter' });
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
      .resolves.toMatchObject({ id: 'inter' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('caches returned details under the requested route id when it differs from the canonical id', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: { family: { ...rawFamily, id: 'canonical-inter' } } }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await loadFamilyDetail({ uid: 'user-a', familyId: 'inter', getIdToken: async () => 'token' });

    expect(getCachedFamily('user-a', 'inter')?.id).toBe('canonical-inter');
    expect(getCachedFamily('user-a', 'canonical-inter')?.id).toBe('canonical-inter');
  });

  it('normalizes missing dates and clones font arrays', () => {
    const serialized = serializeFamilyDetail({ ...rawFamily, uploadDate: null, fonts: rawFamily.fonts });

    expect(serialized?.uploadDate).toBe('');
    expect(serialized?.fonts).toEqual(rawFamily.fonts);
    expect(serialized?.fonts).not.toBe(rawFamily.fonts);
  });
});
