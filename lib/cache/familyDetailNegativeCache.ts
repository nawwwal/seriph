const NEGATIVE_TTL_MS = 30_000;
const MAX_NEGATIVE_ENTRIES = 64;
const negativeFamilies = new Map<string, number>();

function cacheKey(uid: string, familyId: string): string {
  return `${uid}:${familyId}`;
}

function pruneExpired(now: number): void {
  for (const [key, expiresAt] of negativeFamilies) {
    if (expiresAt <= now) negativeFamilies.delete(key);
  }
}

export function hasFamilyDetailNegative(uid: string, familyId: string): boolean {
  const key = cacheKey(uid, familyId);
  const expiresAt = negativeFamilies.get(key);
  if (!expiresAt) return false;
  if (expiresAt > Date.now()) return true;
  negativeFamilies.delete(key);
  return false;
}

export function rememberFamilyDetailNegative(uid: string, familyId: string): void {
  const now = Date.now();
  pruneExpired(now);
  const key = cacheKey(uid, familyId);
  negativeFamilies.delete(key);
  while (negativeFamilies.size >= MAX_NEGATIVE_ENTRIES) {
    const oldest = negativeFamilies.keys().next().value;
    if (!oldest) break;
    negativeFamilies.delete(oldest);
  }
  negativeFamilies.set(key, now + NEGATIVE_TTL_MS);
}

export function clearFamilyDetailNegativeCacheForUser(uid: string): void {
  const prefix = `${uid}:`;
  for (const key of negativeFamilies.keys()) {
    if (key.startsWith(prefix)) negativeFamilies.delete(key);
  }
}
