'use client';

import type { FontFamily } from '@/models/font.models';
import { getCachedFamily } from '@/lib/cache/familyCache';
import {
  cacheFamilyDetailAliases,
  evictFamilyDetail,
  readPersistedFamilyDetail,
  storeFamilyDetail,
} from '@/lib/cache/familyDetailPersistence';
import { serializeFamilyDetail } from '@/lib/cache/familyDetailSerialization';
import {
  requestFamilyDetail,
  type FamilyDetailRequestOutcome,
  type TokenGetter,
} from '@/lib/cache/familyDetailRequest';
import {
  hasFamilyDetailNegative,
  rememberFamilyDetailNegative,
} from '@/lib/cache/familyDetailNegativeCache';

export { serializeFamilyDetail } from '@/lib/cache/familyDetailSerialization';
export { clearFamilyDetailNegativeCacheForUser } from '@/lib/cache/familyDetailNegativeCache';

export interface LoadFamilyDetailInput {
  uid: string;
  familyId: string;
  getIdToken: TokenGetter;
}
export type FamilyDetailLoadOutcome =
  | { kind: 'loaded'; source: 'memory' | 'snapshot' | 'network'; family: FontFamily }
  | { kind: 'not-found' }
  | { kind: 'load-error'; error: Error };

const inFlightLoads = new Map<string, Promise<FamilyDetailLoadOutcome>>();
const inFlightNetwork = new Map<string, Promise<FamilyDetailLoadOutcome>>();

const cacheKey = (uid: string, familyId: string) => `${uid}:${familyId}`;
const toError = (error: unknown) =>
  error instanceof Error ? error : new Error(String(error));

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
    const aliases = await evictFamilyDetail(input.uid, input.familyId);
    for (const alias of aliases) rememberFamilyDetailNegative(input.uid, alias);
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
  if (hasFamilyDetailNegative(input.uid, input.familyId)) {
    return Promise.resolve({ kind: 'not-found' });
  }
  const cached = getCachedFamily(input.uid, input.familyId);
  if (cached) return Promise.resolve({ kind: 'loaded', source: 'memory', family: cached });
  const key = cacheKey(input.uid, input.familyId);
  const existing = inFlightLoads.get(key);
  if (existing) return existing;
  const pending = readPersistedFamilyDetail(input.uid, input.familyId)
    .then((persisted): FamilyDetailLoadOutcome | Promise<FamilyDetailLoadOutcome> => (
      persisted
        ? acceptOutcome(
          input,
          { kind: 'loaded', detail: { family: persisted, canonicalId: persisted.id } },
          'snapshot',
        )
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
    /* Prefetch is opportunistic. */
  }
}
