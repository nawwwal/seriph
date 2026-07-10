import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAccountSnapshots, writeSnapshot } from '@/lib/cache/persistentSnapshots';
import { clearFamilyCacheForUser, getCachedFamily } from '@/lib/cache/familyCache';
import { loadFamilyDetail, refreshFamilyDetail, serializeFamilyDetail } from '@/lib/cache/familyDetailClient';
import { readPersistedFamilyDetail } from '@/lib/cache/familyDetailPersistence';
import { rawFamily, successfulFamilyResponse } from './fixtures/familyDetail';

const persistenceHarness = vi.hoisted(() => ({
  read: null as null | (() => Promise<unknown>),
  store: null as null | (() => Promise<void>),
}));

vi.mock('@/lib/cache/familyDetailPersistence', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/cache/familyDetailPersistence')>();
  return {
    ...actual,
    readPersistedFamilyDetail: (...args: Parameters<typeof actual.readPersistedFamilyDetail>) =>
      persistenceHarness.read?.() ?? actual.readPersistedFamilyDetail(...args),
    storeFamilyDetail: (...args: Parameters<typeof actual.storeFamilyDetail>) =>
      persistenceHarness.store?.() ?? actual.storeFamilyDetail(...args),
  };
});

describe('family detail client refresh', () => {
  beforeEach(async () => {
    clearFamilyCacheForUser('user-a');
    await clearAccountSnapshots({ accountId: 'user-a' });
    persistenceHarness.read = null;
    persistenceHarness.store = null;
    vi.unstubAllGlobals();
  });

  it('publishes an already-read snapshot without waiting for alias persistence', async () => {
    persistenceHarness.read = async () => serializeFamilyDetail(rawFamily);
    let releaseStore = () => {};
    let signalStoreStarted = () => {};
    const storeStarted = new Promise<'store-started'>((resolve) => {
      signalStoreStarted = () => resolve('store-started');
    });
    const storeGate = new Promise<void>((resolve) => { releaseStore = resolve; });
    persistenceHarness.store = () => { signalStoreStarted(); return storeGate; };

    const pending = loadFamilyDetail({ uid: 'user-a', familyId: 'inter', getIdToken: async () => 'token' });
    const observed = await Promise.race([pending, storeStarted]);
    releaseStore();
    await pending;

    expect(observed).toMatchObject({ kind: 'loaded', source: 'snapshot', family: { id: 'inter' } });
    expect(getCachedFamily('user-a', 'inter')?.name).toBe('Inter');
  });

  it('shows a legacy snapshot first and deduplicates its live enrichment refresh', async () => {
    const legacyFamily = { ...rawFamily, id: 'aeonik', normalizedName: 'aeonik' };
    await writeSnapshot({ accountId: 'user-a', kind: 'family-detail', key: 'aeonik', payload: legacyFamily, ttlMs: 60_000 });
    const liveFamily = { ...legacyFamily, description: 'A precise neo-grotesk.', metadata: { enrichment: {
      classification: 'neo-grotesk', summary: 'A precise neo-grotesk.', moods: ['precise'], useCases: ['product UI'],
    } } };
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200,
      json: async () => ({ data: { family: liveFamily, canonicalId: 'aeonik-pro' } }) }));
    vi.stubGlobal('fetch', fetchMock);
    const input = { uid: 'user-a', familyId: 'aeonik', getIdToken: async () => 'token' };

    await expect(loadFamilyDetail(input)).resolves.toMatchObject({ kind: 'loaded', source: 'snapshot' });
    const firstRefresh = refreshFamilyDetail(input);
    const secondRefresh = refreshFamilyDetail(input);
    expect(firstRefresh).toBe(secondRefresh);
    await expect(firstRefresh).resolves.toMatchObject({ kind: 'loaded', source: 'network' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getCachedFamily('user-a', 'aeonik')?.description).toBe('A precise neo-grotesk.');
    expect(getCachedFamily('user-a', 'aeonik-pro')?.metadata.enrichment?.moods).toEqual(['precise']);
    expect((await readPersistedFamilyDetail('user-a', 'aeonik-pro'))?.description).toBe('A precise neo-grotesk.');
  });

  it('retries a failed refresh without discarding the cached family', async () => {
    const input = { uid: 'user-a', familyId: 'inter', getIdToken: async () => 'token' };
    vi.stubGlobal('fetch', vi.fn(successfulFamilyResponse));
    await loadFamilyDetail(input);
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('offline'))
      .mockImplementationOnce(successfulFamilyResponse);
    vi.stubGlobal('fetch', fetchMock);

    await expect(refreshFamilyDetail(input)).resolves.toMatchObject({ kind: 'load-error' });
    expect(getCachedFamily('user-a', 'inter')?.name).toBe('Inter');
    await expect(refreshFamilyDetail(input)).resolves.toMatchObject({ kind: 'loaded', source: 'network' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
