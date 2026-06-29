import { describe, expect, it, vi } from 'vitest';
import { searchFontsForUser } from '@/lib/search/searchApi';

describe('searchFontsForUser', () => {
  it('posts the search query with the Firebase bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { results: [{ id: 'serif', name: 'Serif' }] } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    const results = await searchFontsForUser({
      fetcher: fetchMock,
      getIdToken: async () => 'token-123',
      query: 'editorial',
    });

    expect(results).toEqual([{ id: 'serif', name: 'Serif' }]);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-123' },
      body: JSON.stringify({ q: 'editorial' }),
    });
  });

  it('turns non-json error responses into a useful search error', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('<!DOCTYPE html><html><body>500</body></html>', {
        status: 500,
        headers: { 'content-type': 'text/html' },
      })
    );

    await expect(
      searchFontsForUser({
        fetcher: fetchMock,
        getIdToken: async () => 'token-123',
        query: 'editorial',
      })
    ).rejects.toThrow('Search failed: 500');
  });
});
