import { createElement, type SetStateAction } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useInfiniteFamiliesLoadMore } from '@/lib/hooks/useInfiniteFamiliesLoadMore';
import type { InfiniteFamiliesState } from '@/lib/hooks/infiniteFamiliesState';
import type { ShelfFamily } from '@/models/shelf.models';

const family = (id: number): ShelfFamily => ({
  id: `family-${id}`, name: `Family ${id}`, normalizedName: `family-${id}`,
  classification: 'Sans Serif', styleCount: 1, isVariable: false,
  updatedAt: '2026-07-10T00:00:00.000Z',
});

function pageResponse(): Response {
  const families = Array.from({ length: 48 }, (_, index) => family(index + 49));
  return new Response(JSON.stringify({ data: { families, nextCursor: 'after-96', hasMore: true } }));
}

afterEach(() => vi.unstubAllGlobals());

describe('cached shelf reload and pagination concurrency', () => {
  it('does not interleave pages or advance past a skipped cursor', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => pageResponse());
    vi.stubGlobal('fetch', fetchMock);
    const cachedFamilies = Array.from({ length: 48 }, (_, index) => family(index + 1));
    const cached: InfiniteFamiliesState = {
      userId: 'ada', families: cachedFamilies, nextCursor: 'after-48', hasMore: true,
      isInitialLoading: false, isRefreshing: true, isLoadingMore: false, error: null, stats: null,
    };
    const stateRef = { current: cached };
    const setState = (update: SetStateAction<InfiniteFamiliesState>) => {
      stateRef.current = typeof update === 'function' ? update(stateRef.current) : update;
    };
    const args: Parameters<typeof useInfiniteFamiliesLoadMore>[0] = {
      inFlightMoreRef: { current: false }, moreAbortRef: { current: null }, moreRequestIdRef: { current: 0 },
      setState, stateRef, user: { uid: 'ada', getIdToken: async () => 'token' },
    };
    let loadMore: () => Promise<void> = async () => {
      throw new Error('Load-more callback was not initialized.');
    };
    function Harness() { loadMore = useInfiniteFamiliesLoadMore(args); return null; }

    renderToStaticMarkup(createElement(Harness));
    await loadMore();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(stateRef.current).toMatchObject({ families: cachedFamilies, nextCursor: 'after-48' });

    stateRef.current = { ...stateRef.current, isRefreshing: false };
    await loadMore();
    const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]), 'http://seriph.local');
    expect(requestUrl.searchParams.get('cursor')).toBe('after-48');
    expect(stateRef.current.families).toHaveLength(96);
    expect(stateRef.current.nextCursor).toBe('after-96');
    expect(new Set(stateRef.current.families.map((item) => item.id)).size).toBe(96);
  });
});
