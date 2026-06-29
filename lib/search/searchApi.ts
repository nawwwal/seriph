import type { SearchResultItem } from '@/lib/hooks/useFontSearch';

type Fetcher = typeof fetch;

interface SearchFontsForUserInput {
  fetcher?: Fetcher;
  getIdToken: () => Promise<string>;
  query: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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
}: SearchFontsForUserInput): Promise<SearchResultItem[]> {
  const idToken = await getIdToken();
  const response = await fetcher('/api/v1/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ q: query }),
  });
  const data = await readSearchResponse(response);

  if (!response.ok) {
    const error = isRecord(data) && isRecord(data.error) ? data.error : null;
    const message = error && typeof error.message === 'string' ? error.message : `Search failed: ${response.status}`;
    throw new Error(message);
  }

  const envelope = isRecord(data) && isRecord(data.data) ? data.data : data;
  return isRecord(envelope) && Array.isArray(envelope.results) ? envelope.results : [];
}
