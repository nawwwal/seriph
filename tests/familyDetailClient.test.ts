import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAccountSnapshots, writeSnapshot } from '@/lib/cache/persistentSnapshots';
import { clearFamilyCacheForUser, getCachedFamily } from '@/lib/cache/familyCache';
import { loadFamilyDetail, refreshFamilyDetail, serializeFamilyDetail } from '@/lib/cache/familyDetailClient';
import { readPersistedFamilyDetail } from '@/lib/cache/familyDetailPersistence';
import { rawFamily, successfulFamilyResponse } from './fixtures/familyDetail';

function mockFamilyFetch() { return vi.fn(successfulFamilyResponse); }

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
    await expect(first).resolves.toMatchObject({ kind: 'loaded', source: 'network', family: { id: 'inter', name: 'Inter' } });
    expect(fetchMock).toHaveBeenCalledTimes(1); expect(getIdToken).toHaveBeenCalledTimes(1);
    expect(getCachedFamily('user-a', 'inter')?.name).toBe('Inter');
  });

  it('serves cached detail without another network request', async () => {
    const fetchMock = mockFamilyFetch();
    vi.stubGlobal('fetch', fetchMock);
    await loadFamilyDetail({ uid: 'user-a', familyId: 'inter', getIdToken: async () => 'token' });
    fetchMock.mockClear();

    await expect(loadFamilyDetail({ uid: 'user-a', familyId: 'inter', getIdToken: async () => 'token' }))
      .resolves.toMatchObject({ kind: 'loaded', source: 'memory', family: { id: 'inter' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('hydrates an account-scoped persisted detail before making a network request', async () => {
    await writeSnapshot({ accountId: 'user-a', kind: 'family-detail', key: 'inter', payload: rawFamily, ttlMs: 60_000 });
    const fetchMock = mockFamilyFetch();
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadFamilyDetail({ uid: 'user-a', familyId: 'inter', getIdToken: async () => 'token' }))
      .resolves.toMatchObject({ kind: 'loaded', source: 'snapshot', family: { id: 'inter' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows a legacy snapshot first and deduplicates its live enrichment refresh', async () => {
    const legacyFamily = { ...rawFamily, id: 'aeonik', normalizedName: 'aeonik' };
    await writeSnapshot({ accountId: 'user-a', kind: 'family-detail', key: 'aeonik', payload: legacyFamily, ttlMs: 60_000 });
    const liveFamily = {
      ...legacyFamily,
      description: 'A precise neo-grotesk.',
      metadata: { enrichment: {
        classification: 'neo-grotesk', summary: 'A precise neo-grotesk.', moods: ['precise'], useCases: ['product UI'],
      } },
    };
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200,
      json: async () => ({ data: { family: liveFamily, canonicalId: 'aeonik-pro' } }) }));
    vi.stubGlobal('fetch', fetchMock);
    const input = { uid: 'user-a', familyId: 'aeonik', getIdToken: async () => 'token' };

    await expect(loadFamilyDetail(input)).resolves.toMatchObject({
      kind: 'loaded', source: 'snapshot', family: { description: '', metadata: {} } });
    expect(getCachedFamily('user-a', 'aeonik')?.metadata.enrichment).toBeUndefined();

    const firstRefresh = refreshFamilyDetail(input); const secondRefresh = refreshFamilyDetail(input);
    expect(firstRefresh).toBe(secondRefresh);
    await expect(firstRefresh).resolves.toMatchObject({ kind: 'loaded', source: 'network' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getCachedFamily('user-a', 'aeonik')?.metadata.enrichment?.summary).toBe('A precise neo-grotesk.');
    expect(getCachedFamily('user-a', 'aeonik-pro')?.metadata.enrichment?.moods).toEqual(['precise']);
    expect((await readPersistedFamilyDetail('user-a', 'aeonik-pro'))?.description).toBe('A precise neo-grotesk.');
    expect(getCachedFamily('user-b', 'aeonik')).toBeUndefined();
  });

  it('retries a failed refresh without discarding the cached family', async () => {
    const input = { uid: 'user-a', familyId: 'inter', getIdToken: async () => 'token' };
    vi.stubGlobal('fetch', mockFamilyFetch());
    await loadFamilyDetail(input);
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('offline'))
      .mockImplementationOnce(successfulFamilyResponse);
    vi.stubGlobal('fetch', fetchMock);

    await expect(refreshFamilyDetail(input)).resolves.toMatchObject({ kind: 'load-error', error: new Error('offline') });
    expect(getCachedFamily('user-a', 'inter')?.name).toBe('Inter');
    await expect(refreshFamilyDetail(input)).resolves.toMatchObject({
      kind: 'loaded', source: 'network', family: { id: 'inter' } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('caches returned details under the requested route id when it differs from the canonical id', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: {
      family: { ...rawFamily, id: 'canonical-inter' }, canonicalId: 'canonical-inter-v2',
    } }) }));
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
