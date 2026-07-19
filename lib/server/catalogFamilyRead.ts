import type { Firestore } from 'firebase-admin/firestore';
import { adaptFamilyDoc, isCatalogAliasDoc, isCatalogDoc, mergedInto } from '@/lib/db/catalogAdapter';
import type { FontFamily } from '@/models/font.models';
import { FAMILIES_COLLECTION, findReadableFamily } from '@/lib/server/catalogFamilyShared';

export interface OwnedFamilyDetail {
  family: FontFamily;
  canonicalId: string;
}

export async function getOwnedFamilyDetail(db: Firestore, uid: string, familyId: string): Promise<OwnedFamilyDetail | null> {
  if (!familyId) return null;
  const snap = await findReadableFamily(db, uid, familyId);
  if (!snap || !snap.exists) return null;
  const data = snap.data();
  if (!data || (data.ownerId && data.ownerId !== uid) || !isCatalogDoc(data)) return null;
  const targetId = mergedInto(data);
  if (targetId) return getOwnedFamilyDetail(db, uid, targetId);
  if (isCatalogAliasDoc(data)) return null;
  return { family: adaptFamilyDoc(data, snap.id), canonicalId: snap.id };
}

export async function getOwnedFamily(db: Firestore, uid: string, familyId: string): Promise<FontFamily | null> {
  return (await getOwnedFamilyDetail(db, uid, familyId))?.family ?? null;
}
