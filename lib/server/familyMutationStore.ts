import { FieldValue, type DocumentSnapshot, type Firestore } from 'firebase-admin/firestore';
import {
  FAMILIES_COLLECTION,
  STALE_ENRICHMENT_FIELDS,
  type CatalogFamily,
  type FamilyInput,
  type MutationResult,
} from '@/lib/server/familyMutationTypes';

export interface ResolvedFamilyInput {
  input: FamilyInput;
  docId: string;
}

export function docToFamilyInput(doc: DocumentSnapshot, familyId = doc.id): FamilyInput {
  const data = doc.data();
  return { familyId, data: doc.exists && data ? { ...data } : null };
}

export async function resolveFamilyInput(db: Firestore, uid: string, familyId: string): Promise<ResolvedFamilyInput> {
  const collection = db.collection(FAMILIES_COLLECTION);
  const direct = await collection.doc(familyId).get();
  if (direct.exists && direct.data()?.ownerId === uid) {
    return { input: docToFamilyInput(direct, familyId), docId: direct.id };
  }
  const slugSnap = await collection.where('ownerId', '==', uid).where('slug', '==', familyId).limit(1).get();
  const slugDoc = slugSnap.docs[0];
  if (slugDoc) return { input: docToFamilyInput(slugDoc, familyId), docId: slugDoc.id };
  return { input: { familyId, data: null }, docId: familyId };
}

export async function getFamilyInputs(db: Firestore, uid: string, familyIds: string[]): Promise<ResolvedFamilyInput[]> {
  return Promise.all([...new Set(familyIds)].map((familyId) => resolveFamilyInput(db, uid, familyId)));
}

export function docIdMap(resolved: ResolvedFamilyInput[]): Map<string, string> {
  return new Map(resolved.map((item) => [item.input.familyId, item.docId]));
}

export function applyDeletedFields(update: Record<string, unknown>): Record<string, unknown> {
  const withDeletes: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(update)) {
    if (value !== undefined) withDeletes[key] = value;
  }
  for (const field of STALE_ENRICHMENT_FIELDS) withDeletes[field] = FieldValue.delete();
  withDeletes.updatedAt = FieldValue.serverTimestamp();
  return withDeletes;
}

export function statusForMutation(result: Exclude<MutationResult<unknown>, { ok: true }>): number {
  if (result.code === 'forbidden') return 403;
  if (result.code === 'not_found') return 404;
  return 400;
}
