import { isRecord, isSearchIndexItem, normalizeSearchResult } from '@/lib/search/searchApiParsing';
import { browserSearchFunctionUrl } from '@/lib/search/searchEndpoint';
import type { SearchFilters, SearchIndexResponse, SearchResultItem } from '@/models/search.models';

type Fetcher = typeof fetch;

interface SearchFontsForUserInput {
  fetcher?: Fetcher;
  getIdToken: () => Promise<string>;
  query: string;
  filters?: SearchFilters;
  similarTo?: string;
  signal?: AbortSignal;
}

async function readSearchResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    if (!response.ok) throw new Error(`Search failed: ${response.status}`);
    return {};
  }
  return response.json();
}

export async function searchFontsForUser({
  fetcher = fetch,
  getIdToken,
  query,
  filters,
  similarTo,
  signal,
}: SearchFontsForUserInput): Promise<SearchResultItem[]> {
  const idToken = await getIdToken();
  const init: RequestInit = {
    method: 'POST',
    // text/plain keeps this a simple cross-origin request, avoiding a CORS
    // preflight. The function verifies the token from the encrypted body.
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({ q: query, filters, similarTo, idToken }),
  };
  if (signal) init.signal = signal;
  // The function already authenticates the Firebase bearer token. Calling it
  // directly avoids a second auth pass and the browser -> Next -> function hop.
  const endpoint = browserSearchFunctionUrl({
    NEXT_PUBLIC_SEARCH_FUNCTION_URL: process.env.NEXT_PUBLIC_SEARCH_FUNCTION_URL,
  });
  const response = await fetcher(endpoint, init);
  const data = await readSearchResponse(response);

  if (!response.ok) {
    const error = isRecord(data) && isRecord(data.error) ? data.error : null;
    const message = error && typeof error.message === 'string' ? error.message : `Search failed: ${response.status}`;
    throw new Error(message);
  }

  const envelope = isRecord(data) && isRecord(data.data) ? data.data : data;
  return isRecord(envelope) && Array.isArray(envelope.results)
    ? envelope.results.map(normalizeSearchResult).filter((item): item is SearchResultItem => item !== null)
    : [];
}

export async function fetchSearchIndexForUser({
  fetcher = fetch,
  getIdToken,
  signal,
  revision,
}: Omit<SearchFontsForUserInput, 'query' | 'filters'> & { revision?: number }): Promise<SearchIndexResponse> {
  const idToken = await getIdToken();
  const init: RequestInit = { headers: { Authorization: `Bearer ${idToken}` } };
  if (signal) init.signal = signal;
  const path = typeof revision === 'number' ? `/api/v1/search-index?revision=${revision}` : '/api/v1/search-index';
  const response = await fetcher(path, init);
  const data = await readSearchResponse(response);
  if (!response.ok) throw new Error(isRecord(data) && isRecord(data.error) && typeof data.error.message === 'string' ? data.error.message : `Search index failed: ${response.status}`);
  const envelope = isRecord(data) && isRecord(data.data) ? data.data : data;
  if (!isRecord(envelope) || !Array.isArray(envelope.items)) return { items: [], generatedAt: '', libraryRevision: 0 };
  return {
    items: envelope.items.filter(isSearchIndexItem),
    generatedAt: typeof envelope.generatedAt === 'string' ? envelope.generatedAt : '',
    libraryRevision: typeof envelope.libraryRevision === 'number' ? envelope.libraryRevision : 0,
    unchanged: envelope.unchanged === true,
  };
}
