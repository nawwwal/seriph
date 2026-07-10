'use client';

import type { FontFamily } from '@/models/font.models';
import { getCachedFamily } from '@/lib/cache/familyCache';
import { cacheFamilyDetailAliases, evictFamilyDetail, readPersistedFamilyDetail, storeFamilyDetail } from '@/lib/cache/familyDetailPersistence';
import { familyResponseData, familyResponseError, serializeFamilyDetail } from '@/lib/cache/familyDetailSerialization';
import { hasFamilyDetailNegative, rememberFamilyDetailNegative } from '@/lib/cache/familyDetailNegativeCache';

export { serializeFamilyDetail } from '@/lib/cache/familyDetailSerialization';
export { clearFamilyDetailNegativeCacheForUser } from '@/lib/cache/familyDetailNegativeCache';

type TokenGetter = () => Promise<string>;
export interface LoadFamilyDetailInput { uid: string; familyId: string; getIdToken: TokenGetter }
interface LoadedFamilyDetail { family: FontFamily; canonicalId: string }
type FamilyDetailRequestOutcome =
  | { kind: 'loaded'; detail: LoadedFamilyDetail }
  | { kind: 'not-found' }
  | { kind: 'load-error'; error: Error };
export type FamilyDetailLoadOutcome =
  | { kind: 'loaded'; source: 'memory' | 'snapshot' | 'network'; family: FontFamily }
  | { kind: 'not-found' }
  | { kind: 'load-error'; error: Error };
const inFlightLoads = new Map<string, Promise<FamilyDetailLoadOutcome>>();
const inFlightNetwork = new Map<string, Promise<FamilyDetailLoadOutcome>>();
function cacheKey(uid: string, familyId: string): string {
  return `${uid}:${familyId}`;
}
function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
async function requestFamilyDetail(input: LoadFamilyDetailInput): Promise<FamilyDetailRequestOutcome> {
  try {
    const token = await input.getIdToken();
    const response = await fetch(`/api/v1/families/${encodeURIComponent(input.familyId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 404) return { kind: 'not-found' };
    const json: unknown = await response.json().catch(() => null);
    if (!response.ok) return { kind: 'load-error', error: familyResponseError(json, response.status) };
    const data = familyResponseData(json);
    const family = serializeFamilyDetail(data?.family);
    if (!family) return { kind: 'load-error', error: new Error('Family response did not include valid detail') };
    const canonicalId = typeof data?.canonicalId === 'string' ? data.canonicalId : family.id;
    return { kind: 'loaded', detail: { family, canonicalId } };
  } catch (error) {
    return { kind: 'load-error', error: toError(error) };
  }
}
async function acceptOutcome(
  input: LoadFamilyDetailInput,
  outcome: FamilyDetailRequestOutcome,
  source: 'snapshot' | 'network',
): Promise<FamilyDetailLoadOutcome> {
  if (outcome.kind === 'loaded') {
    const { family, canonicalId } = outcome.detail;
    const detail = { uid: input.uid, routeId: input.familyId, canonicalId, family };
    if (source === 'snapshot') cacheFamilyDetailAliases(detail);
    else await storeFamilyDetail(detail);
    return { kind: 'loaded', source, family };
  }
  if (outcome.kind === 'not-found') {
    rememberFamilyDetailNegative(input.uid, input.familyId);
    await evictFamilyDetail(input.uid, input.familyId);
  }
  return outcome;
}
function requestLiveFamilyDetail(input: LoadFamilyDetailInput): Promise<FamilyDetailLoadOutcome> {
  const key = cacheKey(input.uid, input.familyId);
  const existing = inFlightNetwork.get(key);
  if (existing) return existing;
  const pending = requestFamilyDetail(input)
    .then((outcome) => acceptOutcome(input, outcome, 'network'))
    .finally(() => inFlightNetwork.delete(key));
  inFlightNetwork.set(key, pending);
  return pending;
}
export function loadFamilyDetail(input: LoadFamilyDetailInput): Promise<FamilyDetailLoadOutcome> {
  const cached = getCachedFamily(input.uid, input.familyId);
  if (cached) return Promise.resolve({ kind: 'loaded', source: 'memory', family: cached });
  const key = cacheKey(input.uid, input.familyId);
  if (hasFamilyDetailNegative(input.uid, input.familyId)) return Promise.resolve({ kind: 'not-found' });
  const existing = inFlightLoads.get(key);
  if (existing) return existing;
  const pending = readPersistedFamilyDetail(input.uid, input.familyId)
    .then((persisted): FamilyDetailLoadOutcome | Promise<FamilyDetailLoadOutcome> => (
      persisted
        ? acceptOutcome(input, { kind: 'loaded', detail: { family: persisted, canonicalId: persisted.id } }, 'snapshot')
        : requestLiveFamilyDetail(input)
    ))
    .catch((error): FamilyDetailLoadOutcome => ({ kind: 'load-error', error: toError(error) }))
    .finally(() => inFlightLoads.delete(key));
  inFlightLoads.set(key, pending);
  return pending;
}
export function refreshFamilyDetail(input: LoadFamilyDetailInput): Promise<FamilyDetailLoadOutcome> {
  return requestLiveFamilyDetail(input);
}
export async function prefetchFamilyDetail(input: LoadFamilyDetailInput): Promise<void> {
  try {
    await loadFamilyDetail(input);
  } catch {
  }
}
