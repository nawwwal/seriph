import { type Firestore } from 'firebase-admin/firestore';
import type { Storage } from 'firebase-admin/storage';
import { buildFamilyHardDeletePlan } from '@/lib/server/familyDeletePlan';
import {
  FAMILIES_COLLECTION,
  PUBLIC_BUCKET,
  type CatalogFamily,
  type FamilyInput,
  type HardDeletePlan,
  type MutationResult,
} from '@/lib/server/familyMutationTypes';
import { isRecord } from '@/lib/server/familyMutationUtils';
import { docIdMap, getFamilyInputs, type ResolvedFamilyInput } from '@/lib/server/familyMutationStore';

async function listAliasInputsForTargets(db: Firestore, uid: string, targetIds: string[]): Promise<ResolvedFamilyInput[]> {
  const snap = await db.collection(FAMILIES_COLLECTION).where('ownerId', '==', uid).get();
  const targets = new Set(targetIds);
  return snap.docs.flatMap((doc): ResolvedFamilyInput[] => {
    const data: CatalogFamily = { ...doc.data() };
    const target = typeof data.mergedInto === 'string' ? data.mergedInto : data.aliasOf;
    if (typeof target !== 'string' || !targets.has(target)) return [];
    const familyId = typeof data.slug === 'string' ? data.slug : doc.id;
    const input: FamilyInput = { familyId, data: { ...data, id: data.id ?? familyId, slug: data.slug ?? familyId } };
    return [{ input, docId: doc.id }];
  });
}

async function deleteStoragePath(storage: Storage, storagePath: string): Promise<void> {
  try {
    await storage.bucket(PUBLIC_BUCKET).file(storagePath).delete();
  } catch (error) {
    if (isRecord(error) && (error.code === 404 || error.code === '404')) return;
    throw error;
  }
}

async function cleanupStorage(storage: Storage, paths: string[]): Promise<void> {
  const results = await Promise.allSettled(paths.map((path) => deleteStoragePath(storage, path)));
  const failed = results.filter((result) => result.status === 'rejected');
  if (failed.length > 0) console.warn('Family hard-delete storage cleanup failed', { failedCount: failed.length });
}

export async function applyFamilyHardDelete({
  db,
  storage,
  uid,
  familyIds,
}: {
  db: Firestore;
  storage: Storage;
  uid: string;
  familyIds: string[];
}): Promise<MutationResult<HardDeletePlan>> {
  const selected = await getFamilyInputs(db, uid, familyIds);
  const aliases = await listAliasInputsForTargets(db, uid, familyIds);
  const plan = buildFamilyHardDeletePlan({
    uid,
    familyIds,
    selectedFamilies: selected.map((item) => item.input),
    aliasFamilies: aliases.map((item) => item.input),
  });
  if (!plan.ok) return plan;

  const ids = docIdMap([...selected, ...aliases]);
  const batch = db.batch();
  for (const familyId of plan.value.docIds) batch.delete(db.collection(FAMILIES_COLLECTION).doc(ids.get(familyId) ?? familyId));
  await batch.commit();
  await cleanupStorage(storage, plan.value.storagePaths);
  return plan;
}
