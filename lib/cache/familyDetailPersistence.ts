import type { FontFamily } from '@/models/font.models';
import { cacheFamily, cacheFamilyById, evictCachedFamilyAliases } from '@/lib/cache/familyCache';
import { readSnapshot, writeSnapshot } from '@/lib/cache/persistentSnapshots';
import { serializeFamilyDetail } from '@/lib/cache/familyDetailSerialization';

const DETAIL_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function readPersistedFamilyDetail(
  uid: string,
  familyId: string
): Promise<FontFamily | null> {
  const record = await readSnapshot({ accountId: uid, kind: 'family-detail', key: familyId });
  return record ? serializeFamilyDetail(record.payload) : null;
}

export function persistFamilyDetail(uid: string, familyId: string, family: FontFamily): Promise<void> {
  return writeSnapshot({
    accountId: uid,
    kind: 'family-detail',
    key: familyId,
    payload: family,
    ttlMs: DETAIL_TTL_MS,
    maxEntries: 24,
  });
}

export function cacheFamilyDetailAliases(input: {
  uid: string;
  routeId: string;
  canonicalId: string;
  family: FontFamily;
}): void {
  const { uid, routeId, canonicalId, family } = input;
  cacheFamily(uid, family);
  cacheFamilyById(uid, routeId, family);
  cacheFamilyById(uid, canonicalId, family);
}

export async function storeFamilyDetail(input: {
  uid: string;
  routeId: string;
  canonicalId: string;
  family: FontFamily;
}): Promise<void> {
  const { uid, routeId, canonicalId, family } = input;
  cacheFamilyDetailAliases(input);
  await Promise.allSettled([
    persistFamilyDetail(uid, routeId, family),
    persistFamilyDetail(uid, canonicalId, family),
  ]);
}

export async function evictFamilyDetail(uid: string, familyId: string): Promise<void> {
  const aliases = evictCachedFamilyAliases(uid, familyId);
  await Promise.allSettled(aliases.map((key) => writeSnapshot({
    accountId: uid,
    kind: 'family-detail',
    key,
    payload: null,
    ttlMs: 0,
  })));
}
