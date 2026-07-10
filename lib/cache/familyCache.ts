import type { FontFamily } from '@/models/font.models';

/**
 * Process-wide in-memory cache of fully-adapted families, scoped by owner uid.
 * Family ids can be shared across users, so uid is part of the cache key.
 */
const familiesById = new Map<string, FontFamily>();

function cacheKey(uid: string, familyId: string): string {
  return `${uid}:${familyId}`;
}

export function cacheFamily(uid: string, family: FontFamily): void {
  cacheFamilyById(uid, family.id, family);
}

export function cacheFamilyById(uid: string, familyId: string, family: FontFamily): void {
  familiesById.set(cacheKey(uid, familyId), family);
}

export function getCachedFamily(uid: string | undefined, id: string | undefined): FontFamily | undefined {
  return uid && id ? familiesById.get(cacheKey(uid, id)) : undefined;
}

export function evictCachedFamilyAliases(uid: string, familyId: string): string[] {
  const prefix = `${uid}:`;
  const target = familiesById.get(cacheKey(uid, familyId));
  if (!target) return [familyId];
  const aliases: string[] = [];
  for (const [key, family] of familiesById) {
    if (key.startsWith(prefix) && family === target) {
      aliases.push(key.slice(prefix.length));
      familiesById.delete(key);
    }
  }
  return aliases;
}

export function clearFamilyCacheForUser(uid: string): void {
  for (const key of familiesById.keys()) {
    if (key.startsWith(`${uid}:`)) familiesById.delete(key);
  }
}
