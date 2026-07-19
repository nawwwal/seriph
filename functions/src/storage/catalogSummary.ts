import type { Firestore } from 'firebase-admin/firestore';
import { readQueryPages } from './paginatedRead';

const FAMILY_COLLECTION = 'fontfamilies';
const SUMMARY_COLLECTION = 'catalogSummaries';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function timestamp(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') return Date.parse(value) || 0;
  if (isRecord(value) && typeof value.seconds === 'number') return value.seconds * 1000;
  return 0;
}

function styles(data: Record<string, unknown>): number {
  if (data.styleCount !== undefined) {
    if (typeof data.styleCount !== 'number' || !Number.isSafeInteger(data.styleCount) || data.styleCount < 0) throw new Error('catalog style count overflow');
    return data.styleCount;
  }
  return Array.isArray(data.faces) ? data.faces.length : 0;
}

function addCount(total: number, next: number): number {
  const value = total + next;
  if (!Number.isSafeInteger(value)) throw new Error('catalog summary count overflow');
  return value;
}

export function summarizeCatalogFamilyRecords(records: Record<string, unknown>[], now: string, libraryRevision: number) {
  let familyCount = 0;
  let styleCount = 0;
  let recentFamilyName: string | null = null;
  let recentCreatedAt = 0;
  for (const record of records) {
    if (record.hidden === true) continue;
    familyCount = addCount(familyCount, 1);
    styleCount = addCount(styleCount, styles(record));
    const createdAt = timestamp(record.createdAt);
    if (createdAt >= recentCreatedAt) {
      recentCreatedAt = createdAt;
      recentFamilyName = typeof record.name === 'string' ? record.name : null;
    }
  }
  return { familyCount, styleCount, recentFamilyName, generatedAt: now, updatedAt: now, libraryRevision };
}

function revision(value: unknown): number {
  const current = isRecord(value) && value.libraryRevision !== undefined ? value.libraryRevision : 0;
  if (!Number.isSafeInteger(current) || (current as number) < 0 || (current as number) >= Number.MAX_SAFE_INTEGER) {
    throw new Error('catalog library revision overflow');
  }
  return (current as number) + 1;
}

function processedTokens(value: unknown): string[] {
  if (!isRecord(value)) return [];
  const stored = Array.isArray(value.catalogSummaryInvalidationTokens) ? value.catalogSummaryInvalidationTokens : [];
  const legacy = typeof value.lastInvalidationToken === 'string' ? [value.lastInvalidationToken] : [];
  return [...new Set([...stored, ...legacy].filter((token): token is string => typeof token === 'string'))];
}

const pendingSummaryRebuilds = new Map<string, Promise<void>>();

export function catalogSummaryTaskKey(ownerId: string, batchId?: string): string {
  return batchId ? `import-batch:${ownerId}:${batchId}` : ownerId;
}

export async function rebuildCatalogSummary(db: Firestore, ownerId: string, taskKey = catalogSummaryTaskKey(ownerId)): Promise<void> {
  const pending = pendingSummaryRebuilds.get(taskKey);
  if (pending) return pending;
  const work = (async () => {
  const ref = db.collection(SUMMARY_COLLECTION).doc(ownerId);
  const families = await readQueryPages(db.collection(FAMILY_COLLECTION).where('ownerId', '==', ownerId)
    .select('name', 'styleCount', 'faces', 'createdAt', 'hidden'), FAMILY_COLLECTION);
  const invalidationToken = taskKey.startsWith('import-batch:') ? taskKey : undefined;
  await db.runTransaction(async (tx) => {
    const current = await tx.get(ref); const data = current.data();
    const tokens = processedTokens(data);
    if (invalidationToken && tokens.includes(invalidationToken)) return;
    const summary = summarizeCatalogFamilyRecords(families.map((doc) => doc.data()), new Date().toISOString(), revision(data));
    tx.set(ref, { ...summary, ...(invalidationToken ? { lastInvalidationToken: invalidationToken, catalogSummaryInvalidationTokens: [...tokens, invalidationToken] } : data?.lastInvalidationToken ? { lastInvalidationToken: data.lastInvalidationToken } : {}) });
  });
  })();
  pendingSummaryRebuilds.set(taskKey, work);
  try { await work; } finally { if (pendingSummaryRebuilds.get(taskKey) === work) pendingSummaryRebuilds.delete(taskKey); }
}
