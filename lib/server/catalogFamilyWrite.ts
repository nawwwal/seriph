import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { isCatalogAliasDoc, mergedInto } from '@/lib/db/catalogAdapter';
import type { FontFamily } from '@/models/font.models';
import { STALE_ENRICHMENT_FIELDS } from '@/lib/server/familyMutationTypes';
import { findOwnedTopLevelFamily } from '@/lib/server/catalogFamilyShared';
import { getOwnedFamily } from '@/lib/server/catalogFamilyRead';

function markNeedsEnrichment(update: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...update, status: 'ready', updatedAt: FieldValue.serverTimestamp() };
  for (const field of STALE_ENRICHMENT_FIELDS) next[field] = FieldValue.delete();
  return next;
}

function faceId(face: unknown): string | null {
  return face && typeof face === 'object' && 'id' in face && typeof face.id === 'string' ? face.id : null;
}

export async function patchOwnedFamily({
  db,
  uid,
  familyId,
  payload,
}: {
  db: Firestore;
  uid: string;
  familyId: string;
  payload: Record<string, unknown>;
}): Promise<FontFamily | null> {
  const snap = await findOwnedTopLevelFamily(db, uid, familyId);
  const current = snap?.data();
  if (!snap?.exists || !current || current.ownerId !== uid) return null;
  const targetId = mergedInto(current);
  if (targetId) return patchOwnedFamily({ db, uid, familyId: targetId, payload });
  if (isCatalogAliasDoc(current)) return null;

  const update: Record<string, unknown> = {};
  const enrichment = typeof current.enrichment === 'object' && current.enrichment !== null ? { ...current.enrichment } : {};
  if (typeof payload.description === 'string') enrichment.summary = payload.description;
  if (Array.isArray(payload.tags)) enrichment.moods = payload.tags.filter((tag): tag is string => typeof tag === 'string');
  if (typeof payload.foundry === 'string') update.foundry = payload.foundry;
  if (Object.keys(enrichment).length > 0) update.enrichment = enrichment;
  await snap.ref.set(markNeedsEnrichment(update), { merge: true });
  return getOwnedFamily(db, uid, familyId);
}

export async function deleteOwnedFamilyFace({
  db,
  uid,
  familyId,
  fontId,
}: {
  db: Firestore;
  uid: string;
  familyId: string;
  fontId: string;
}): Promise<{ deleted: boolean; faces: unknown[] } | null> {
  const snap = await findOwnedTopLevelFamily(db, uid, familyId);
  const current = snap?.data();
  if (!snap?.exists || !current || current.ownerId !== uid) return null;
  const targetId = mergedInto(current);
  if (targetId) return deleteOwnedFamilyFace({ db, uid, familyId: targetId, fontId });
  if (isCatalogAliasDoc(current)) return null;
  const faces = Array.isArray(current.faces) ? current.faces : [];
  const nextFaces = faces.filter((face) => faceId(face) !== fontId);
  if (nextFaces.length === faces.length) return { deleted: false, faces };
  const coverFaceId = nextFaces.some((face) => faceId(face) === current.coverFaceId)
    ? current.coverFaceId
    : faceId(nextFaces[0]);
  await snap.ref.set(markNeedsEnrichment({ faces: nextFaces, coverFaceId }), { merge: true });
  return { deleted: true, faces: nextFaces };
}
