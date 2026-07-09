import 'fake-indexeddb/auto';
import { createElement, type SetStateAction } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAccountSnapshots } from '@/lib/cache/persistentSnapshots';
import { useInfiniteFamiliesLoadMore } from '@/lib/hooks/useInfiniteFamiliesLoadMore';
import { useInfiniteFamiliesReload } from '@/lib/hooks/useInfiniteFamiliesReload';
import { emptyInfiniteFamiliesState, type InfiniteFamiliesState } from '@/lib/hooks/infiniteFamiliesState';
import { readPersistentShelfCache } from '@/lib/shelf/persistentShelfCache';
import { readShelfFamilyCache } from '@/lib/shelf/familyPageCache';
import type { ShelfFamily, ShelfStatsSummary } from '@/models/shelf.models';

const family = (id: number): ShelfFamily => ({
  id: `family-${id}`, name: `Family ${id}`, normalizedName: `family-${id}`,
  classification: 'Sans Serif', styleCount: 1, isVariable: false,
  updatedAt: '2026-07-10T00:00:00.000Z',
});
const stats: ShelfStatsSummary = {
  familyCount: 96, styleCount: 96, recentFamilyName: 'Family 96', libraryRevision: 2,
  generatedAt: '2026-07-10T00:00:00.000Z', updatedAt: '2026-07-10T00:00:00.000Z',
};
const response = (families: ShelfFamily[], nextCursor: string | null, hasMore: boolean) =>
  new Response(JSON.stringify({ data: { families, nextCursor, hasMore } }));

describe('reload stats and append concurrency', () => {
  beforeEach(async () => {
    await clearAccountSnapshots({ accountId: 'ada' });
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
  });

  it('applies delayed stats to the latest appended page and cache', async () => {
    let resolveStats = (_response: Response) => {};
    const delayedStats = new Promise<Response>((resolve) => { resolveStats = resolve; });
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/stats')) return delayedStats;
      const cursor = new URL(url, 'http://seriph.local').searchParams.get('cursor');
      const start = cursor ? 49 : 1;
      return Promise.resolve(response(Array.from({ length: 48 }, (_, index) => family(start + index)), cursor ? 'after-96' : 'after-48', true));
    }));
    const stateRef = { current: emptyInfiniteFamiliesState };
    const setState = (update: SetStateAction<InfiniteFamiliesState>) => {
      stateRef.current = typeof update === 'function' ? update(stateRef.current) : update;
    };
    const refs = {
      abortRef: { current: null }, inFlightMoreRef: { current: false }, moreAbortRef: { current: null },
      moreRequestIdRef: { current: 0 }, requestId: { current: 0 },
    };
    const user = { uid: 'ada', getIdToken: async () => 'token' };
    let reload = async () => {}; let loadMore = async () => {};
    function Harness() {
      reload = useInfiniteFamiliesReload({ ...refs, authLoading: false, setState, user });
      loadMore = useInfiniteFamiliesLoadMore({ ...refs, setState, stateRef, user });
      return null;
    }

    renderToStaticMarkup(createElement(Harness));
    const reloading = reload();
    await vi.waitFor(() => expect(stateRef.current.nextCursor).toBe('after-48'));
    await loadMore();
    resolveStats(new Response(JSON.stringify({ data: stats })));
    await reloading;

    expect(stateRef.current).toMatchObject({ nextCursor: 'after-96', stats });
    expect(stateRef.current.families).toHaveLength(96);
    expect(readShelfFamilyCache('ada')).toMatchObject({ nextCursor: 'after-96', stats });
    await expect(readPersistentShelfCache('ada')).resolves.toMatchObject({ nextCursor: 'after-96', stats });
  });
});
