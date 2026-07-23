import type { PaginatedFamiliesResponse } from '@/models/shelf.models';
import { FAMILY_PAGE_SIZE, parseShelfFamilyPage, parseShelfStats } from '@/lib/shelf/familyPageCache';

interface FetchFamilyPageInput {
  getIdToken: () => Promise<string>;
  cursor: string | null;
  signal?: AbortSignal;
}

function errorMessage(json: unknown, status: number): string {
  if (json && typeof json === 'object' && 'error' in json) {
    const error = json.error;
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
      return error.message;
    }
  }
  return `Failed to load families: ${status}`;
}

export async function fetchFamilyPage({
  getIdToken,
  cursor,
  signal,
}: FetchFamilyPageInput): Promise<PaginatedFamiliesResponse> {
  const token = await getIdToken();
  const params = new URLSearchParams({ limit: String(FAMILY_PAGE_SIZE) });
  if (cursor) {
    params.set('cursor', cursor);
  } else {
    params.set('stats', '1');
  }
  const response = await fetch(`/api/v1/families?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  const json: unknown = await response.json();
  if (!response.ok) throw new Error(errorMessage(json, response.status));
  if (!json || typeof json !== 'object' || !('data' in json)) throw new Error('Malformed family response.');
  const page = parseShelfFamilyPage(json.data);
  if (!page) throw new Error('Malformed family response.');
  return page;
}

export async function fetchShelfStats({
  getIdToken,
  signal,
}: Pick<FetchFamilyPageInput, 'getIdToken' | 'signal'>): Promise<NonNullable<PaginatedFamiliesResponse['stats']>> {
  const token = await getIdToken();
  const response = await fetch('/api/v1/families/stats', {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  const json: unknown = await response.json();
  if (!response.ok) throw new Error(errorMessage(json, response.status));
  if (!json || typeof json !== 'object' || !('data' in json)) throw new Error('Malformed stats response.');
  const stats = parseShelfStats(json.data);
  if (!stats) throw new Error('Malformed stats response.');
  return stats;
}
