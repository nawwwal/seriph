import { FieldPath, type Firestore, type Query, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { decodeFamilyCursor, encodeFamilyCursor, mapCatalogDocToShelfFamily } from '@/lib/api/familyShelf';
import type { PaginatedFamiliesResponse } from '@/models/shelf.models';
import { cursorFromDoc, FAMILIES_COLLECTION, parseLimit } from '@/lib/server/catalogFamilyShared';
import { isFirestoreIndexUnavailable, sortCatalogDocsByName } from '@/lib/server/firestoreQueryFallback';
import { getShelfStats } from '@/lib/server/catalogFamilyStats';

export async function listShelfFamilies({
  db,
  uid,
  limitParam,
  cursorParam,
  includeStats = false,
}: {
  db: Firestore;
  uid: string;
  limitParam: string | null;
  cursorParam: string | null;
  includeStats?: boolean;
}): Promise<PaginatedFamiliesResponse> {
  const limit = parseLimit(limitParam);
  const cursor = decodeFamilyCursor(cursorParam);
  const statsPromise = includeStats && !cursor ? getShelfStats(db, uid) : undefined;
  let q: Query = db.collection(FAMILIES_COLLECTION)
    .where('ownerId', '==', uid)
    .where('hidden', '==', false)
    .orderBy('name', 'asc')
    .orderBy(FieldPath.documentId())
    .select('slug', 'name', 'ownerId', 'category', 'classification', 'updatedAt', 'styleCount', 'isVariable', 'axes', 'coverFace', 'status', 'hidden')
    .limit(limit + 1);
  let scanCursor = cursor;
  if (scanCursor) q = q.startAfter(scanCursor.sortValue, scanCursor.id);
  let docs: QueryDocumentSnapshot[];
  try {
    const snap = await q.get();
    docs = snap.docs;
  } catch (error) {
    if (!isFirestoreIndexUnavailable(error)) throw error;
    const snap = await db.collection(FAMILIES_COLLECTION)
      .where('ownerId', '==', uid)
      .where('hidden', '==', false)
      .select('slug', 'name', 'ownerId', 'category', 'classification', 'updatedAt', 'styleCount', 'isVariable', 'axes', 'coverFace', 'status', 'hidden')
      .get();
    const sorted = sortCatalogDocsByName(snap.docs);
    docs = scanCursor
      ? sorted.filter((doc) => {
        const current = cursorFromDoc(doc);
        return current.sortValue > scanCursor!.sortValue ||
          (current.sortValue === scanCursor!.sortValue && current.id > scanCursor!.id);
      }).slice(0, limit + 1)
      : sorted.slice(0, limit + 1);
  }

  const visibleDocs = docs.slice(0, limit);
  const nextCursorSource = docs.length > limit ? cursorFromDoc(visibleDocs[visibleDocs.length - 1]!) : scanCursor;
  const hasMore = docs.length > limit;
  const stats = await statsPromise;
  return {
    families: visibleDocs.map((doc) => mapCatalogDocToShelfFamily(doc.data(), doc.id)),
    hasMore,
    nextCursor: hasMore && nextCursorSource ? encodeFamilyCursor(nextCursorSource) : null,
    ...(stats ? { stats } : {}),
  };
}
