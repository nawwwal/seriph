import { FieldPath, type Firestore, type Query, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { isCatalogAliasDoc } from '@/lib/db/catalogAdapter';
import { decodeFamilyCursor, encodeFamilyCursor, mapCatalogDocToShelfFamily } from '@/lib/api/familyShelf';
import type { PaginatedFamiliesResponse } from '@/models/shelf.models';
import { cursorFromDoc, FAMILIES_COLLECTION, parseLimit } from '@/lib/server/catalogFamilyShared';
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
    .orderBy('name', 'asc')
    .orderBy(FieldPath.documentId())
    .select('slug', 'name', 'ownerId', 'category', 'classification', 'updatedAt', 'faces', 'coverFaceId', 'status', 'hidden', 'mergedInto', 'aliasOf')
    .limit(limit + 1);
  const docs: QueryDocumentSnapshot[] = [];
  let scanCursor = cursor;
  let exhausted = false;

  while (docs.length <= limit && !exhausted) {
    let pageQuery = q.limit(limit + 1);
    if (scanCursor) pageQuery = pageQuery.startAfter(scanCursor.sortValue, scanCursor.id);
    const snap = await pageQuery.get();
    if (snap.empty) {
      exhausted = true;
      break;
    }
    for (const doc of snap.docs) {
      if (!isCatalogAliasDoc(doc.data())) docs.push(doc);
      if (docs.length > limit) break;
    }
    scanCursor = cursorFromDoc(snap.docs[snap.docs.length - 1]!);
    exhausted = snap.docs.length < limit + 1;
  }

  const visibleDocs = docs.slice(0, limit);
  const nextCursorSource = docs.length > limit ? cursorFromDoc(visibleDocs[visibleDocs.length - 1]!) : scanCursor;
  const hasMore = docs.length > limit || !exhausted;
  const stats = await statsPromise;
  return {
    families: visibleDocs.map((doc) => mapCatalogDocToShelfFamily(doc.data(), doc.id)),
    hasMore,
    nextCursor: hasMore && nextCursorSource ? encodeFamilyCursor(nextCursorSource) : null,
    ...(stats ? { stats } : {}),
  };
}
