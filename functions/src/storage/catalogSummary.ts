import type { Firestore } from 'firebase-admin/firestore';

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
  if (typeof data.styleCount === 'number') return data.styleCount;
  return Array.isArray(data.faces) ? data.faces.length : 0;
}

export function summarizeCatalogFamilyRecords(records: Record<string, unknown>[], now: string, libraryRevision: number) {
  let familyCount = 0;
  let styleCount = 0;
  let recentFamilyName: string | null = null;
  let recentCreatedAt = 0;
  for (const record of records) {
    if (record.hidden === true) continue;
    familyCount += 1;
    styleCount += styles(record);
    const createdAt = timestamp(record.createdAt);
    if (createdAt >= recentCreatedAt) {
      recentCreatedAt = createdAt;
      recentFamilyName = typeof record.name === 'string' ? record.name : null;
    }
  }
  return { familyCount, styleCount, recentFamilyName, generatedAt: now, updatedAt: now, libraryRevision };
}

function revision(value: unknown): number {
  return isRecord(value) && typeof value.libraryRevision === 'number' ? value.libraryRevision + 1 : 1;
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
  const [families, current] = await Promise.all([
    db.collection(FAMILY_COLLECTION).where('ownerId', '==', ownerId).select('name', 'styleCount', 'faces', 'createdAt', 'hidden').get(),
    ref.get(),
  ]);
  await ref.set(summarizeCatalogFamilyRecords(
    families.docs.map((doc) => doc.data()), new Date().toISOString(), revision(current.data())
  ));
  })();
  pendingSummaryRebuilds.set(taskKey, work);
  try { await work; } finally { if (pendingSummaryRebuilds.get(taskKey) === work) pendingSummaryRebuilds.delete(taskKey); }
}
