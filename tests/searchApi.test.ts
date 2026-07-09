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

    expect(results).toEqual([{
      id: 'serif',
      slug: 'serif',
      normalizedName: 'serif',
      name: 'Serif',
      category: '',
      classification: 'Sans Serif',
      summary: undefined,
      moods: undefined,
      useCases: undefined,
      styleCount: 0,
      isVariable: false,
      updatedAt: '',
      coverUrl: undefined,
      coverFace: undefined,
      score: undefined,
      scoreBreakdown: undefined,
      source: 'semantic',
    }]);
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

  it('coarsens semantic classification phrases for filterable voice labels', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { results: [{ id: 'ivar', name: 'Ivar', classification: 'high-contrast transitional display serif' }] } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    const results = await searchFontsForUser({ fetcher: fetchMock, getIdToken: async () => 'token-123', query: 'ivar' });

    expect(results[0]?.classification).toBe('Serif');
  });

  it('sends structured filters to the semantic search endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { results: [] } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    await searchFontsForUser({
      fetcher: fetchMock,
      getIdToken: async () => 'token-123',
      query: 'warm sans',
      filters: { classifications: ['Sans Serif'], moods: ['warm'], styleRanges: ['5-8'], variable: 'variable' },
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/search', expect.objectContaining({
      body: JSON.stringify({ q: 'warm sans', filters: { classifications: ['Sans Serif'], moods: ['warm'], styleRanges: ['5-8'], variable: 'variable' } }),
    }));
  });

});
