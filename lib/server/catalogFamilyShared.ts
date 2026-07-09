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
  const canonical = await db.collection(FAMILIES_COLLECTION).doc(canonicalFamilyDocId(uid, familyId)).get();
  if (canonical.exists && canonical.data()?.ownerId === uid) return canonical;
  const direct = await db.collection(FAMILIES_COLLECTION).doc(familyId).get();
  const directData = direct.data();
  if (direct.exists && directData?.ownerId === uid) return direct;
  const slugSnap = await db.collection(FAMILIES_COLLECTION)
    .where('ownerId', '==', uid)
    .where('slug', '==', familyId)
    .limit(1)
    .get();
  return slugSnap.docs[0] ?? null;
}

export async function findReadableFamily(db: Firestore, uid: string, familyId: string): Promise<DocumentSnapshot | null> {
  const topLevel = await findOwnedTopLevelFamily(db, uid, familyId);
  if (topLevel) return topLevel;
  const legacy = await db.collection('users').doc(uid).collection('fontfamilies').doc(familyId).get();
  return legacy.exists ? legacy : null;
}
