import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { ShelfStatsSummary } from '@/models/shelf.models';
import { FAMILIES_COLLECTION } from '@/lib/server/catalogFamilyShared';
import { summarizeCatalogFamilies } from '@/lib/server/catalogSummaryMath';

export { summarizeCatalogFamilies } from '@/lib/server/catalogSummaryMath';

const SUMMARIES_COLLECTION = 'catalogSummaries';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function storedSummary(value: unknown): ShelfStatsSummary | null {
  if (!isRecord(value)) return null;
  if (typeof value.familyCount !== 'number' || typeof value.styleCount !== 'number') return null;
  if (typeof value.libraryRevision !== 'number' || typeof value.generatedAt !== 'string' || typeof value.updatedAt !== 'string') return null;
  return {
    familyCount: value.familyCount,
    styleCount: value.styleCount,
    recentFamilyName: typeof value.recentFamilyName === 'string' ? value.recentFamilyName : null,
    generatedAt: value.generatedAt,
    libraryRevision: value.libraryRevision,
    updatedAt: value.updatedAt,
  };
}

export function catalogSummaryRef(db: Firestore, uid: string) {
  return db.collection(SUMMARIES_COLLECTION).doc(uid);
}

export async function readCatalogSummary(db: Firestore, uid: string): Promise<ShelfStatsSummary | null> {
  return storedSummary((await catalogSummaryRef(db, uid).get()).data());
}

export async function rebuildCatalogSummary(db: Firestore, uid: string): Promise<ShelfStatsSummary> {
  const [families, existing] = await Promise.all([
    db.collection(FAMILIES_COLLECTION).where('ownerId', '==', uid).select('name', 'styleCount', 'faces', 'createdAt', 'hidden').get(),
    readCatalogSummary(db, uid),
  ]);
  const now = new Date().toISOString();
  const summary = summarizeCatalogFamilies(families.docs.map((doc) => doc.data()), now);
  const next = { ...summary, libraryRevision: (existing?.libraryRevision ?? 0) + 1 };
  await catalogSummaryRef(db, uid).set(next);
  return next;
}

export async function bumpCatalogRevision(db: Firestore, uid: string): Promise<void> {
  const ref = catalogSummaryRef(db, uid);
  const current = await ref.get();
  if (!storedSummary(current.data())) return;
  await ref.update({ libraryRevision: FieldValue.increment(1), updatedAt: new Date().toISOString() });
}
