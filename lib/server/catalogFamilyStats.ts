import type { Firestore } from 'firebase-admin/firestore';
import type { ShelfStatsSummary } from '@/models/shelf.models';
import { FAMILIES_COLLECTION } from '@/lib/server/catalogFamilyShared';

const CACHE_TTL_MS = 30_000;
const statsCache = new Map<string, {
  expiresAt: number;
  promise?: Promise<ShelfStatsSummary>;
  value?: ShelfStatsSummary;
}>();

function timestampMillis(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') return Date.parse(value) || 0;
  if (typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  if (typeof (value as { seconds?: unknown }).seconds === 'number') {
    return (value as { seconds: number }).seconds * 1000;
  }
  return 0;
}

function styleCountFor(data: Record<string, unknown>): number {
  if (typeof data.styleCount === 'number') return data.styleCount;
  return Array.isArray(data.faces) ? data.faces.length : 0;
}

async function readShelfStats(db: Firestore, uid: string): Promise<ShelfStatsSummary> {
  const snap = await db.collection(FAMILIES_COLLECTION)
    .where('ownerId', '==', uid)
    .where('hidden', '==', false)
    .select('name', 'styleCount', 'createdAt', 'updatedAt', 'status', 'hidden')
    .get();
  let familyCount = 0;
  let styleCount = 0;
  let recentFamilyName: string | null = null;
  let recentTime = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    familyCount += 1;
    styleCount += styleCountFor(data);
    const createdOrUpdated = timestampMillis(data.createdAt) || timestampMillis(data.updatedAt);
    if (createdOrUpdated >= recentTime) {
      recentTime = createdOrUpdated;
      recentFamilyName = typeof data.name === 'string' ? data.name : doc.id;
    }
  }
  return { familyCount, styleCount, recentFamilyName, generatedAt: new Date().toISOString() };
}

export function clearShelfStatsCache(uid: string): void {
  statsCache.delete(uid);
}

export async function getShelfStats(db: Firestore, uid: string): Promise<ShelfStatsSummary> {
  const cached = statsCache.get(uid);
  if (cached?.value && cached.expiresAt > Date.now()) return cached.value;
  if (cached?.promise) return cached.promise;

  const promise = readShelfStats(db, uid);
  statsCache.set(uid, { expiresAt: Date.now() + CACHE_TTL_MS, promise });
  try {
    const value = await promise;
    statsCache.set(uid, { expiresAt: Date.now() + CACHE_TTL_MS, value });
    return value;
  } catch (error) {
    if (statsCache.get(uid)?.promise === promise) statsCache.delete(uid);
    throw error;
  }
}
