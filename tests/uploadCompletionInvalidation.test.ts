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

const polling = vi.hoisted(() => ({ onCompleted: undefined as (() => void) | undefined }));

vi.mock('@/lib/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user-a' }, isLoading: false }),
}));
vi.mock('@/lib/contexts/useActiveUploadPolling', () => ({
  useActiveUploadPolling: ({ onCompleted }: { onCompleted: () => void }) => {
    polling.onCompleted = onCompleted;
    return [];
  },
}));

import { UploadProvider } from '@/lib/contexts/UploadContext';

describe('upload completion detail invalidation', () => {
  beforeEach(async () => {
    polling.onCompleted = undefined;
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
    expect(polling.onCompleted).toBeTypeOf('function');
    polling.onCompleted?.();

    await expect(loadFamilyDetail(input('user-a'))).resolves.toMatchObject({ kind: 'loaded' });
    await expect(loadFamilyDetail(input('user-b'))).resolves.toEqual({ kind: 'not-found' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
