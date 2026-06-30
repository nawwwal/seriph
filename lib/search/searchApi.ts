import { isRecord, isSearchIndexItem, normalizeSearchResult } from '@/lib/search/searchApiParsing';
import type { SearchFilters, SearchIndexResponse, SearchResultItem } from '@/models/search.models';

type Fetcher = typeof fetch;

interface SearchFontsForUserInput {
  fetcher?: Fetcher;
  getIdToken: () => Promise<string>;
  query: string;
  filters?: SearchFilters;
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
  signal,
}: SearchFontsForUserInput): Promise<SearchResultItem[]> {
  const idToken = await getIdToken();
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ q: query, filters }),
  };
  if (signal) init.signal = signal;
  const response = await fetcher('/api/v1/search', init);
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
}: Omit<SearchFontsForUserInput, 'query'>): Promise<SearchIndexResponse> {
  const idToken = await getIdToken();
  const init: RequestInit = { headers: { Authorization: `Bearer ${idToken}` } };
  if (signal) init.signal = signal;
  const response = await fetcher('/api/v1/search-index', init);
  const data = await readSearchResponse(response);
  if (!response.ok) throw new Error(isRecord(data) && isRecord(data.error) && typeof data.error.message === 'string' ? data.error.message : `Search index failed: ${response.status}`);
  const envelope = isRecord(data) && isRecord(data.data) ? data.data : data;
  if (!isRecord(envelope) || !Array.isArray(envelope.items)) return { items: [], generatedAt: '' };
  return { items: envelope.items.filter(isSearchIndexItem), generatedAt: typeof envelope.generatedAt === 'string' ? envelope.generatedAt : '' };
}
