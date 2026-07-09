import { describe, expect, it } from 'vitest';
import { searchFunctionUrl } from '@/lib/search/searchEndpoint';

describe('searchFunctionUrl', () => {
  it('uses the one configured function URL or its US default', () => {
    expect(searchFunctionUrl({})).toBe('https://us-central1-seriph.cloudfunctions.net/searchFontsHttpUs');
    expect(searchFunctionUrl({ SEARCH_FUNCTION_URL: 'https://search.example.test' })).toBe('https://search.example.test');
  });
});
