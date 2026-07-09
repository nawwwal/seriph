import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAccountSnapshots } from '@/lib/cache/persistentSnapshots';
import { clearFamilyCacheForUser } from '@/lib/cache/familyCache';
import * as familyDetailClient from '@/lib/cache/familyDetailClient';
import { loadFamilyDetail, prefetchFamilyDetail } from '@/lib/cache/familyDetailClient';
import { failedFamilyResponse, successfulFamilyResponse } from './fixtures/familyDetail';

describe('family detail missing outcomes', () => {
  beforeEach(async () => {
    clearFamilyCacheForUser('user-a');
    clearFamilyCacheForUser('user-b');
    await clearAccountSnapshots({ accountId: 'user-a' });
    await clearAccountSnapshots({ accountId: 'user-b' });
    vi.unstubAllGlobals();
  });

  afterEach(() => vi.useRealTimers());

  it('returns a definitive not-found outcome for a 404 without retrying', async () => {
    const fetchMock = vi.fn(() => failedFamilyResponse(404, 'Family not found'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadFamilyDetail({
      uid: 'user-a', familyId: 'missing-family', getIdToken: async () => 'token',
    })).resolves.toEqual({ kind: 'not-found' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retains a definitive 404 across prefetch and navigation for one account', async () => {
    const fetchMock = vi.fn(() => failedFamilyResponse(404, 'Family not found'));
    vi.stubGlobal('fetch', fetchMock);
    const input = {
      uid: 'user-a', familyId: 'prefetched-missing-family', getIdToken: async () => 'token',
    };

    await prefetchFamilyDetail(input);
    await expect(loadFamilyDetail(input)).resolves.toEqual({ kind: 'not-found' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(loadFamilyDetail({ ...input, uid: 'user-b' })).resolves.toEqual({ kind: 'not-found' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('settles a 404 before reading its delayed response body', async () => {
    let signalBodyRead = () => {};
    const bodyRead = new Promise<'body-read'>((resolve) => {
      signalBodyRead = () => resolve('body-read');
    });
    const delayedBody = new Promise<never>(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 404,
      json: () => {
        signalBodyRead();
        return delayedBody;
      },
    })));

    const outcome = loadFamilyDetail({
      uid: 'user-a', familyId: 'delayed-body-family', getIdToken: async () => 'token',
    });

    await expect(Promise.race([outcome, bodyRead])).resolves.toEqual({ kind: 'not-found' });
  });

  it('keeps non-404 response failures distinct from not-found', async () => {
    const fetchMock = vi.fn(() => failedFamilyResponse(503, 'Service unavailable'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadFamilyDetail({
      uid: 'user-a', familyId: 'unavailable-family', getIdToken: async () => 'token',
    })).resolves.toMatchObject({ kind: 'load-error', error: new Error('Service unavailable') });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('expires a prefetched 404 so a later family or alias can resolve', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-10T00:00:00.000Z'));
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => failedFamilyResponse(404, 'Family not found'))
      .mockImplementationOnce(successfulFamilyResponse);
    vi.stubGlobal('fetch', fetchMock);
    const input = { uid: 'user-a', familyId: 'later-created-family', getIdToken: async () => 'token' };

    await prefetchFamilyDetail(input);
    await expect(loadFamilyDetail(input)).resolves.toEqual({ kind: 'not-found' });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date('2026-07-10T00:01:00.001Z'));
    await expect(loadFamilyDetail(input)).resolves.toMatchObject({ kind: 'loaded' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('allows account-scoped mutation invalidation before the negative TTL expires', async () => {
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => failedFamilyResponse(404, 'Family not found'))
      .mockImplementationOnce(successfulFamilyResponse);
    vi.stubGlobal('fetch', fetchMock);
    const input = { uid: 'user-a', familyId: 'restored-family', getIdToken: async () => 'token' };

    await prefetchFamilyDetail(input);
    const invalidate = Reflect.get(familyDetailClient, 'clearFamilyDetailNegativeCacheForUser');
    expect(invalidate).toBeTypeOf('function');
    if (typeof invalidate === 'function') invalidate('user-a');

    await expect(loadFamilyDetail(input)).resolves.toMatchObject({ kind: 'loaded' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
