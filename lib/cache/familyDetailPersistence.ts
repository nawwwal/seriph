import type { FontFamily } from '@/models/font.models';
import {
  rememberPersistedFamilyDetailAliases,
  takePersistedFamilyDetailAliases,
} from '@/lib/cache/familyDetailAliasRegistry';
import { cacheFamily, cacheFamilyById, evictCachedFamilyAliases } from '@/lib/cache/familyCache';
import { listSnapshots, readSnapshot, writeSnapshot } from '@/lib/cache/persistentSnapshots';
import { serializeFamilyDetail } from '@/lib/cache/familyDetailSerialization';

const DETAIL_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function canonicalCandidates(uid: string, familyId: string): string[] {
  const prefix = `${uid}__`;
  if (familyId.startsWith(prefix)) return unique([familyId, familyId.slice(prefix.length)]);
  return unique([familyId, `${prefix}${familyId}`]);
}

async function legacySnapshotAliases(uid: string, familyId: string): Promise<string[]> {
  const candidates = new Set(canonicalCandidates(uid, familyId));
  const snapshots = await listSnapshots({ accountId: uid, kind: 'family-detail', limit: 24 });
  return snapshots.flatMap((snapshot) => {
    const family = serializeFamilyDetail(snapshot.payload);
    return family && candidates.has(family.id) ? [snapshot.key] : [];
  });
}

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
    rememberPersistedFamilyDetailAliases({
      accountId: uid,
      canonicalId,
      aliases: [routeId, family.id],
    }),
  ]);
}

export async function evictFamilyDetail(uid: string, familyId: string): Promise<string[]> {
  const persistedAliases = unique([
    familyId,
    ...(await takePersistedFamilyDetailAliases({ accountId: uid, familyId })),
    ...(await legacySnapshotAliases(uid, familyId)),
  ]);
  const aliases = unique([
    ...persistedAliases.flatMap((alias) => evictCachedFamilyAliases(uid, alias)),
    ...persistedAliases,
  ]);
  await Promise.allSettled(aliases.map((key) => writeSnapshot({
    accountId: uid,
    kind: 'family-detail',
    key,
    payload: null,
    ttlMs: 0,
  })));
  return aliases;
}
