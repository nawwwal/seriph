import { randomUUID } from 'node:crypto';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { buildFamilyMergePlan } from '@/lib/server/familyMergePlan';
import {
  FAMILIES_COLLECTION,
  MERGE_COLLECTION,
  type FamilyMergePlan,
  type MutationResult,
} from '@/lib/server/familyMutationTypes';
import { isRecord } from '@/lib/server/familyMutationUtils';
import { applyDeletedFields, docIdMap, getFamilyInputs } from '@/lib/server/familyMutationStore';
import { queueEnrichmentJobInBatch, resolveEnrichmentJobConfig } from '@/lib/server/enrichmentJobQueue';
import { cleanupSuggestionsForFamilies } from '@/lib/server/mergeSuggestions';

export async function applyFamilyMerge({
  db,
  uid,
  familyIds,
  targetFamilyId,
  mergeId = randomUUID(),
  now = new Date(),
}: {
  db: Firestore;
  uid: string;
  familyIds: string[];
  targetFamilyId: string;
  mergeId?: string;
  now?: Date;
}): Promise<MutationResult<FamilyMergePlan>> {
  const resolved = await getFamilyInputs(db, uid, familyIds);
  const plan = buildFamilyMergePlan({ uid, mergeId, familyIds, targetFamilyId, families: resolved.map((item) => item.input), now });
  if (!plan.ok) return plan;

  const ids = docIdMap(resolved);
  const batch = db.batch();
  const collection = db.collection(FAMILIES_COLLECTION);
  const nextVersion = Number((plan.value.targetDoc as Record<string, unknown>).version ?? 0) + 1;
  const targetSlug = typeof plan.value.targetDoc.slug === 'string' && plan.value.targetDoc.slug
    ? plan.value.targetDoc.slug
    : plan.value.targetFamilyId;
  batch.set(
    collection.doc(ids.get(plan.value.targetFamilyId) ?? plan.value.targetFamilyId),
    applyDeletedFields({ ...plan.value.targetDoc, version: nextVersion }),
    { merge: true },
  );
  for (const alias of plan.value.aliasDocs) {
    batch.set(collection.doc(ids.get(alias.familyId) ?? alias.familyId), applyDeletedFields(alias.doc), { merge: true });
  }
  batch.set(db.collection('users').doc(uid).collection(MERGE_COLLECTION).doc(plan.value.mergeId), {
    ...plan.value.operation,
    createdAt: FieldValue.serverTimestamp(),
  });
  const enrichmentConfig = await resolveEnrichmentJobConfig();
  queueEnrichmentJobInBatch(batch, db, { ownerId: uid, familySlug: targetSlug, familyVersion: nextVersion, now, config: enrichmentConfig });
  await batch.commit();
  await cleanupSuggestionsForFamilies(db, uid, familyIds).catch(() => undefined);
  return plan;
}

export async function undoFamilyMerge({
  db,
  uid,
  mergeId,
  now = new Date(),
}: {
  db: Firestore;
  uid: string;
  mergeId: string;
  now?: Date;
}): Promise<MutationResult<{ restoredFamilyIds: string[] }>> {
  const opRef = db.collection('users').doc(uid).collection(MERGE_COLLECTION).doc(mergeId);
  const opSnap = await opRef.get();
  if (!opSnap.exists) return { ok: false, code: 'not_found', message: 'Merge undo window was not found.' };
  const data = opSnap.data();
  if (!data || data.ownerId !== uid) return { ok: false, code: 'forbidden', message: 'Merge undo is not owned by the current user.' };
  if (data.undoneAt) return { ok: false, code: 'bad_request', message: 'Merge has already been undone.' };
  const expiresAt = typeof data.undoExpiresAt === 'string' ? new Date(data.undoExpiresAt) : null;
  if (!expiresAt || expiresAt.getTime() < now.getTime()) return { ok: false, code: 'bad_request', message: 'Merge undo window has expired.' };
  const snapshots = Array.isArray(data.snapshots) ? data.snapshots.filter(isRecord) : [];
  if (snapshots.length === 0) return { ok: false, code: 'bad_request', message: 'Merge snapshot is empty.' };

  const batch = db.batch();
  const restoredFamilyIds: string[] = [];
  for (const snapshot of snapshots) {
    if (typeof snapshot.familyId !== 'string' || !isRecord(snapshot.data)) continue;
    const resolved = await getFamilyInputs(db, uid, [snapshot.familyId]);
    batch.set(db.collection(FAMILIES_COLLECTION).doc(resolved[0]?.docId ?? snapshot.familyId), { ...snapshot.data, updatedAt: FieldValue.serverTimestamp() }, { merge: false });
    restoredFamilyIds.push(snapshot.familyId);
  }
  batch.set(opRef, { undoneAt: FieldValue.serverTimestamp() }, { merge: true });
  await batch.commit();
  return { ok: true, value: { restoredFamilyIds } };
}
