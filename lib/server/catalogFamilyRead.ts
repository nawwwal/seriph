import type { Firestore } from 'firebase-admin/firestore';
import { adaptFamilyDoc, isCatalogAliasDoc, mergedInto } from '@/lib/db/catalogAdapter';
import type { FontFamily } from '@/models/font.models';
import { FAMILIES_COLLECTION, findReadableFamily } from '@/lib/server/catalogFamilyShared';

export async function getOwnedFamily(db: Firestore, uid: string, familyId: string): Promise<FontFamily | null> {
  if (!familyId) return null;
  const snap = await findReadableFamily(db, uid, familyId);
  if (!snap || !snap.exists) return null;
  const data = snap.data();
  if (!data || (data.ownerId && data.ownerId !== uid)) return null;
  const targetId = mergedInto(data);
  if (targetId) return getOwnedFamily(db, uid, targetId);
  if (isCatalogAliasDoc(data)) return null;
  if (snap.ref.parent.path !== FAMILIES_COLLECTION) return adaptFamilyDoc(data, snap.id);
  return adaptFamilyDoc(data, snap.id);
}
