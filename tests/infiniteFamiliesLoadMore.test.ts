import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useInfiniteFamiliesLoadMore } from '@/lib/hooks/useInfiniteFamiliesLoadMore';
import type { InfiniteFamiliesState } from '@/lib/hooks/infiniteFamiliesState';
import type { ShelfFamily, ShelfStatsSummary } from '@/models/shelf.models';

const stats: ShelfStatsSummary = {
  familyCount: 232,
  styleCount: 412,
  recentFamilyName: 'Zed',
  generatedAt: '2026-07-10T00:00:00.000Z',
  libraryRevision: 12,
  updatedAt: '2026-07-10T00:00:00.000Z',
};

const family = (id: number): ShelfFamily => ({
  id: `family-${id}`,
  name: `Family ${id}`,
  normalizedName: `family-${id}`,
  classification: 'Sans Serif',
  styleCount: 1,
  isVariable: false,
  updatedAt: '2026-07-10T00:00:00.000Z',
});

function pageResponse(families: ShelfFamily[], nextCursor: string | null, hasMore: boolean): Response {
  return new Response(JSON.stringify({ data: { families, nextCursor, hasMore } }), { status: 200 });
}

afterEach(() => vi.unstubAllGlobals());

describe('useInfiniteFamiliesLoadMore', () => {
  it('continues from the latest cached cursor until the server returns the final page', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(pageResponse([family(48), ...Array.from({ length: 47 }, (_, index) => family(index + 49))], 'after-95', true))
      .mockResolvedValueOnce(pageResponse([family(95), family(96)], null, false));
    vi.stubGlobal('fetch', fetchMock);
    const cached: InfiniteFamiliesState = {
      userId: 'ada', families: Array.from({ length: 48 }, (_, index) => family(index + 1)),
      nextCursor: 'after-48', hasMore: true, isInitialLoading: false, isRefreshing: false,
      isLoadingMore: false, error: null, stats,
    };
    let current = cached;
    const stateRef = { current: cached };
    const setState = (update: InfiniteFamiliesState | ((state: InfiniteFamiliesState) => InfiniteFamiliesState)) => {
      current = typeof update === 'function' ? update(current) : update;
      stateRef.current = current;
    };
    const args: Parameters<typeof useInfiniteFamiliesLoadMore>[0] = {
      activeState: { ...cached, nextCursor: null, hasMore: false },
      inFlightMore: { current: false }, moreAbortRef: { current: null }, moreRequestId: { current: 0 },
      setState, stateRef,
      user: { uid: 'ada', getIdToken: async () => 'token' },
    };
    let loadMore: () => Promise<void> = async () => { throw new Error('Load-more callback was not initialized.'); };
    function Harness() {
      loadMore = useInfiniteFamiliesLoadMore(args);
      return null;
    }

    renderToStaticMarkup(createElement(Harness));
    await loadMore();

    expect(new URL(String(fetchMock.mock.calls[0]?.[0]), 'http://seriph.local').searchParams.get('cursor')).toBe('after-48');
    expect(current.families).toHaveLength(95);
    expect(new Set(current.families.map((item) => item.id)).size).toBe(95);
    expect(current.stats).toEqual(stats);
    expect(current.hasMore).toBe(true);

    await loadMore();

    expect(new URL(String(fetchMock.mock.calls[1]?.[0]), 'http://seriph.local').searchParams.get('cursor')).toBe('after-95');
    expect(current.families).toHaveLength(96);
    expect(current.hasMore).toBe(false);
    expect(current.nextCursor).toBeNull();
  });
});
