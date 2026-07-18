import 'fake-indexeddb/auto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAccountSnapshots } from '@/lib/cache/persistentSnapshots';
import { clearFamilyCacheForUser } from '@/lib/cache/familyCache';
import {
  clearFamilyDetailNegativeCacheForUser,
  loadFamilyDetail,
  prefetchFamilyDetail,
} from '@/lib/cache/familyDetailClient';
import { failedFamilyResponse, successfulFamilyResponse } from './fixtures/familyDetail';

const feed = vi.hoisted(() => ({ onCompletion: undefined as ((event: { kind: 'families_applied'; batchId: string; delta: number }) => void) | undefined }));

vi.mock('@/lib/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user-a' }, isLoading: false }),
}));
vi.mock('@/lib/contexts/useActiveUploadPolling', () => ({
  useActiveUploadPolling: () => [],
}));
vi.mock('@/lib/hooks/useImportBatchFeed', () => ({
  useImportBatchFeed: ({ onCompletion }: { onCompletion: typeof feed.onCompletion }) => {
    feed.onCompletion = onCompletion;
    return { batches: [], activeCount: 0, transport: 'realtime', loadOlder: vi.fn() };
  },
}));
vi.mock('@/lib/hooks/useImportBatchChildren', () => ({
  useImportBatchChildren: () => ({ children: {}, loadChildren: vi.fn(), collapse: vi.fn() }),
}));

import { UploadProvider } from '@/lib/contexts/UploadContext';

describe('upload completion detail invalidation', () => {
  beforeEach(async () => {
    feed.onCompletion = undefined;
    for (const uid of ['user-a', 'user-b']) {
      clearFamilyCacheForUser(uid);
      clearFamilyDetailNegativeCacheForUser(uid);
      await clearAccountSnapshots({ accountId: uid });
    }
    vi.unstubAllGlobals();
  });

  it('clears active-account negatives without a shelf subscriber', async () => {
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => failedFamilyResponse(404, 'Missing'))
      .mockImplementationOnce(() => failedFamilyResponse(404, 'Missing'))
      .mockImplementationOnce(successfulFamilyResponse);
    vi.stubGlobal('fetch', fetchMock);
    const input = (uid: string) => ({ uid, familyId: 'imported-family', getIdToken: async () => 'token' });

    await prefetchFamilyDetail(input('user-a'));
    await prefetchFamilyDetail(input('user-b'));
    renderToStaticMarkup(createElement(UploadProvider, null, createElement('span')));
    expect(feed.onCompletion).toBeTypeOf('function');
    feed.onCompletion?.({ kind: 'families_applied', batchId: 'b1', delta: 1 });

    await expect(loadFamilyDetail(input('user-a'))).resolves.toMatchObject({ kind: 'loaded' });
    await expect(loadFamilyDetail(input('user-b'))).resolves.toEqual({ kind: 'not-found' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
