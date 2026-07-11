import type { FontFamily } from '@/models/font.models';
import {
  familyResponseData,
  familyResponseError,
  serializeFamilyDetail,
} from '@/lib/cache/familyDetailSerialization';

export type TokenGetter = (forceRefresh?: boolean) => Promise<string>;

export type FamilyDetailRequestOutcome =
  | { kind: 'loaded'; detail: { family: FontFamily; canonicalId: string } }
  | { kind: 'not-found' }
  | { kind: 'load-error'; error: Error };

function isUnauthorized(error: Error): boolean {
  return /unauthorized/i.test(error.message);
}

async function fetchFamilyDetail(
  familyId: string,
  token: string,
): Promise<FamilyDetailRequestOutcome> {
  const response = await fetch(`/api/v1/families/${encodeURIComponent(familyId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 404) return { kind: 'not-found' };
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) return { kind: 'load-error', error: familyResponseError(json, response.status) };
  const data = familyResponseData(json);
  const family = serializeFamilyDetail(data?.family);
  if (!family) {
    return { kind: 'load-error', error: new Error('Family response did not include valid detail') };
  }
  const canonicalId = typeof data?.canonicalId === 'string' ? data.canonicalId : family.id;
  return { kind: 'loaded', detail: { family, canonicalId } };
}

/** Fetch family detail; force-refresh the ID token once on 401. */
export async function requestFamilyDetail(input: {
  familyId: string;
  getIdToken: TokenGetter;
}): Promise<FamilyDetailRequestOutcome> {
  try {
    const token = await input.getIdToken(false);
    if (!token) {
      return { kind: 'load-error', error: new Error('Missing auth token') };
    }
    const first = await fetchFamilyDetail(input.familyId, token);
    if (first.kind !== 'load-error' || !isUnauthorized(first.error)) return first;

    const refreshed = await input.getIdToken(true);
    if (!refreshed) return first;
    return fetchFamilyDetail(input.familyId, refreshed);
  } catch (error) {
    return {
      kind: 'load-error',
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
