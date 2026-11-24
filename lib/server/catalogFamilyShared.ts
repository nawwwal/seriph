import { type DocumentSnapshot, type Firestore, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { canonicalFamilyDocId } from '@/lib/server/catalogFamilyIdentity';

export const FAMILIES_COLLECTION = 'fontfamilies';
export const DEFAULT_LIMIT = 48;
export const MAX_LIMIT = 96;

export function parseLimit(raw: string | null): number {
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_LIMIT;
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, parsed));
}

export function cursorFromDoc(doc: QueryDocumentSnapshot): { sortValue: string; id: string } {
  const name = doc.get('name');
  return { sortValue: typeof name === 'string' ? name : doc.id, id: doc.id };
}

export async function findOwnedTopLevelFamily(
  db: Firestore,
  uid: string,
  familyId: string
): Promise<DocumentSnapshot | null> {
  if (!familyId || familyId === '.' || familyId === '..' || familyId.includes('/')) return null;
  const canonicalId = canonicalFamilyDocId(uid, familyId);
  const canonical = await db.collection(FAMILIES_COLLECTION).doc(canonicalId).get();
  if (canonical.exists && canonical.data()?.ownerId === uid) return canonical;
  if (canonicalId !== familyId) {
    const direct = await db.collection(FAMILIES_COLLECTION).doc(familyId).get();
    if (direct.exists && direct.data()?.ownerId === uid) return direct;
  }
  const slugSnap = await db.collection(FAMILIES_COLLECTION)
    .where('ownerId', '==', uid)
    .where('slug', '==', familyId)
    .limit(5)
    .get();
  return slugSnap.docs.find((doc) => doc.data()?.hidden !== true) ?? slugSnap.docs[0] ?? null;
}

export async function findReadableFamily(db: Firestore, uid: string, familyId: string): Promise<DocumentSnapshot | null> {
  return findOwnedTopLevelFamily(db, uid, familyId);
}
