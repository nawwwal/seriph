import type { FamilyMergeSuggestion } from '@/lib/server/mergeSuggestions';

interface ApiEnvelope<T> {
  data?: T;
  error?: { message?: string };
}

export async function fetchMergeSuggestions(getIdToken: () => Promise<string>): Promise<FamilyMergeSuggestion[]> {
  const token = await getIdToken();
  const response = await fetch('/api/v1/family-merge-suggestions', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await response.json()) as ApiEnvelope<{ suggestions?: FamilyMergeSuggestion[] }>;
  if (!response.ok) throw new Error(json.error?.message || `Request failed: ${response.status}`);
  return json.data?.suggestions ?? [];
}

export async function dismissMergeSuggestionRequest(getIdToken: () => Promise<string>, suggestionId: string): Promise<void> {
  const token = await getIdToken();
  const response = await fetch(`/api/v1/family-merge-suggestions/${encodeURIComponent(suggestionId)}/dismiss`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const json = (await response.json().catch(() => ({}))) as ApiEnvelope<unknown>;
    throw new Error(json.error?.message || `Request failed: ${response.status}`);
  }
}

export type { FamilyMergeSuggestion };
