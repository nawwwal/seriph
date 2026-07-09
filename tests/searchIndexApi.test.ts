import { describe, expect, it, vi } from 'vitest';
import { fetchSearchIndexForUser } from '@/lib/search/searchApi';

describe('fetchSearchIndexForUser', () => {
  it('loads the compact local search index', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: { generatedAt: 'now', items: [{ id: 'ivar', slug: 'ivar', name: 'Ivar', searchText: 'ivar editorial serif', searchTokens: ['ivar', 'editorial'] }], libraryRevision: 4 },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const index = await fetchSearchIndexForUser({ fetcher: fetchMock, getIdToken: async () => 'token-123' });

    expect(index).toMatchObject({ libraryRevision: 4, items: [expect.objectContaining({ id: 'ivar' })] });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/search-index', { headers: { Authorization: 'Bearer token-123' } });
  });

  it('checks a cached index revision without downloading its items again', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: { generatedAt: 'now', items: [], libraryRevision: 4, unchanged: true },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const index = await fetchSearchIndexForUser({ fetcher: fetchMock, getIdToken: async () => 'token-123', revision: 4 });

    expect(index).toMatchObject({ items: [], libraryRevision: 4, unchanged: true });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/search-index?revision=4', { headers: { Authorization: 'Bearer token-123' } });
  });
});
