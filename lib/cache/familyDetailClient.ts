'use client';

import type { FontFamily } from '@/models/font.models';
import { cacheFamily, cacheFamilyById, getCachedFamily } from '@/lib/cache/familyCache';
import { readSnapshot, writeSnapshot } from '@/lib/cache/persistentSnapshots';
import {
  familyResponseData,
  familyResponseError,
  serializeFamilyDetail,
} from '@/lib/cache/familyDetailSerialization';

export { serializeFamilyDetail } from '@/lib/cache/familyDetailSerialization';

type TokenGetter = () => Promise<string>;
interface LoadFamilyDetailInput {
  uid: string;
  familyId: string;
  getIdToken: TokenGetter;
}
interface LoadedFamilyDetail {
  family: FontFamily;
  canonicalId: string;
}
type FamilyDetailRequestOutcome =
  | { kind: 'loaded'; detail: LoadedFamilyDetail }
  | { kind: 'not-found' }
  | { kind: 'load-error'; error: Error };
export type FamilyDetailLoadOutcome =
  | { kind: 'loaded'; family: FontFamily }
  | { kind: 'not-found' }
  | { kind: 'load-error'; error: Error };
const inFlightFamilies = new Map<string, Promise<FamilyDetailLoadOutcome>>();
const notFoundFamilies = new Set<string>();
const DETAIL_TTL_MS = 30 * 24 * 60 * 60 * 1000;
function cacheKey(uid: string, familyId: string): string {
  return `${uid}:${familyId}`;
}
function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
async function readPersistedFamilyDetail(input: LoadFamilyDetailInput): Promise<FontFamily | null> {
  const record = await readSnapshot({ accountId: input.uid, kind: 'family-detail', key: input.familyId });
  return record ? serializeFamilyDetail(record.payload) : null;
}
function persistFamilyDetail(uid: string, familyId: string, family: FontFamily): void { void writeSnapshot({ accountId: uid, kind: 'family-detail', key: familyId, payload: family, ttlMs: DETAIL_TTL_MS, maxEntries: 24 }); }
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
export function loadFamilyDetail(input: LoadFamilyDetailInput): Promise<FamilyDetailLoadOutcome> {
  const cached = getCachedFamily(input.uid, input.familyId);
  if (cached) return Promise.resolve({ kind: 'loaded', family: cached });
  const key = cacheKey(input.uid, input.familyId);
  if (notFoundFamilies.has(key)) return Promise.resolve({ kind: 'not-found' });
  const existing = inFlightFamilies.get(key);
  if (existing) return existing;
  const pending = readPersistedFamilyDetail(input)
    .then((persisted): FamilyDetailRequestOutcome | Promise<FamilyDetailRequestOutcome> => (
      persisted
        ? { kind: 'loaded', detail: { family: persisted, canonicalId: persisted.id } }
        : requestFamilyDetail(input)
    ))
    .then((outcome): FamilyDetailLoadOutcome => {
      if (outcome.kind === 'loaded') {
        const { family, canonicalId } = outcome.detail;
        cacheFamily(input.uid, family);
        cacheFamilyById(input.uid, input.familyId, family);
        cacheFamilyById(input.uid, canonicalId, family);
        persistFamilyDetail(input.uid, input.familyId, family);
        persistFamilyDetail(input.uid, canonicalId, family);
        return { kind: 'loaded', family };
      }
      if (outcome.kind === 'not-found') notFoundFamilies.add(key);
      return outcome;
    })
    .catch((error): FamilyDetailLoadOutcome => ({ kind: 'load-error', error: toError(error) }))
    .finally(() => {
      inFlightFamilies.delete(key);
    });
  inFlightFamilies.set(key, pending);
  return pending;
}
export async function prefetchFamilyDetail(input: LoadFamilyDetailInput): Promise<void> {
  try {
    await loadFamilyDetail(input);
  } catch {
  }
}
