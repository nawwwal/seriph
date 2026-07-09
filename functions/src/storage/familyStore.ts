/**
 * Family document store. New owner-scoped families live in
 * `fontfamilies/{ownerId}__{slug}` with `slug` preserved as the public
 * canonical key. Legacy slug-keyed docs remain readable during migration.
 */
import { getFirestore, FieldValue, Firestore } from 'firebase-admin/firestore';
import type { GfCategory } from './canonicalize';
import type { CanonicalAxis, FontFace, FontFamilyDoc } from '../models/catalog.models';
import { catalogFamilyDocId } from './catalogIdentity';
import { aliasTargetDocId, isAliasFamilyDoc } from './familyAlias';
import { mergeFaceIntoFamily, newFamilyDoc } from './familyUpsertMerge';
import { nextFamilyStatusAfterFaceMerge } from './familyStatus';
import { rebuildCatalogSummary } from './catalogSummary';
export { nextFamilyStatusAfterFaceMerge } from './familyStatus';

export const FAMILIES_COLLECTION = 'fontfamilies';

export interface UpsertFaceInput {
  slug: string;
  name: string;
  fileBase: string;
  category: GfCategory;
  classification?: string;
  foundry?: string;
  designer?: string;
  license?: string;
  subsets?: string[];
  ownerId?: string;
  familyAxes?: CanonicalAxis[];
  face: FontFace;
}

/** Create or update the family doc, merging in one face. Returns the resulting doc. */
export async function upsertFace(
  input: UpsertFaceInput,
  db: Firestore = getFirestore()
): Promise<FontFamilyDoc> {
  const docId = catalogFamilyDocId(input.ownerId, input.slug);
  const ref = db.collection(FAMILIES_COLLECTION).doc(docId);
  const family = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = FieldValue.serverTimestamp();
    if (!snap.exists) {
      const doc = newFamilyDoc(input, docId, now);
      tx.set(ref, doc);
      return doc;
    }

    const existing = snap.data() as FontFamilyDoc;
    if (isAliasFamilyDoc(existing)) {
      const targetDocId = aliasTargetDocId(existing);
      const targetRef = targetDocId ? db.collection(FAMILIES_COLLECTION).doc(targetDocId) : ref;
      const targetSnap = targetDocId ? await tx.get(targetRef) : snap;
      const target = (targetSnap.exists ? targetSnap.data() : existing) as FontFamilyDoc;
      const merged = mergeFaceIntoFamily(target, input, now);
      tx.set(targetRef, merged, { merge: true });
      return { ...target, ...merged, id: targetRef.id } as FontFamilyDoc;
    }

    const merged = mergeFaceIntoFamily(existing, input, now);
    tx.set(ref, merged, { merge: true });
    return { ...existing, ...merged } as FontFamilyDoc;
  });
  if (input.ownerId) await rebuildCatalogSummary(db, input.ownerId);
  return family;
}
