import {
  MERGE_VERSION,
  STALE_ENRICHMENT_FIELDS,
  UNDO_WINDOW_MS,
  type CatalogFace,
  type CatalogFamily,
  type FamilyLike,
  type FamilyMergePlan,
  type MutationResult,
} from '@/lib/server/familyMutationTypes';
import { cleanCatalogDoc, faceList, isRecord, lookupFamilies, unique, validateOwnedVisibleFamilies } from '@/lib/server/familyMutationUtils';
function conflictSuffix(sourceFamilyId: string): string {
  return sourceFamilyId.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'merged';
}
function nextFaceId(baseId: string, sourceFamilyId: string, usedIds: Set<string>): string {
  const suffix = conflictSuffix(sourceFamilyId);
  let candidate = `${baseId}-${suffix}`;
  let index = 2;
  while (usedIds.has(candidate)) {
    candidate = `${baseId}-${suffix}-${index}`;
    index += 1;
  }
  return candidate;
}
function mergeFaces(targetFamilyId: string, selectedFamilies: Array<{ familyId: string; data: CatalogFamily }>): CatalogFace[] {
  const merged: CatalogFace[] = [];
  const usedIds = new Set<string>();
  const seenHashes = new Set<string>();
  for (const family of selectedFamilies) {
    for (const face of faceList(family.data)) {
      const hash = typeof face.contentHash === 'string' ? face.contentHash : null;
      if (hash && seenHashes.has(hash)) continue;
      const id = usedIds.has(face.id) ? nextFaceId(face.id, family.familyId === targetFamilyId ? 'target' : family.familyId, usedIds) : face.id;
      merged.push(id === face.id ? { ...face } : { ...face, id });
      usedIds.add(id);
      if (hash) seenHashes.add(hash);
    }
  }
  return merged;
}
function mergedAxes(families: CatalogFamily[]): unknown[] | undefined {
  const axesByTag = new Map<string, unknown>();
  for (const family of families) {
    if (!Array.isArray(family.axes)) continue;
    for (const axis of family.axes) if (isRecord(axis) && typeof axis.tag === 'string') axesByTag.set(axis.tag, axis);
  }
  return axesByTag.size ? [...axesByTag.values()] : undefined;
}
export function buildFamilyMergePlan({
  uid,
  mergeId,
  familyIds,
  targetFamilyId,
  families,
  now,
}: {
  uid: string;
  mergeId: string;
  familyIds: string[];
  targetFamilyId: string;
  families: FamilyLike[];
  now: Date;
}): MutationResult<FamilyMergePlan> {
  const selectedIds = unique(familyIds);
  if (selectedIds.length < 2) return { ok: false, code: 'bad_request', message: 'Select at least two families to merge.' };
  if (!selectedIds.includes(targetFamilyId)) return { ok: false, code: 'bad_request', message: 'Merge target must be one of the selected families.' };
  const byId = lookupFamilies(families);
  const validation = validateOwnedVisibleFamilies(uid, selectedIds, byId);
  if (!validation.ok) return validation;
  const selected = selectedIds.map((familyId) => ({ familyId, data: byId.get(familyId)! }));
  const target = byId.get(targetFamilyId);
  if (!target) return { ok: false, code: 'not_found', message: `Family ${targetFamilyId} was not found.` };
  const sourceIds = selectedIds.filter((familyId) => familyId !== targetFamilyId);
  const requestedAt = now.toISOString();
  const undoExpiresAt = new Date(now.getTime() + UNDO_WINDOW_MS).toISOString();
  const faces = mergeFaces(targetFamilyId, selected);
  const targetDoc: CatalogFamily = {
    ...cleanCatalogDoc(target),
    id: targetFamilyId,
    slug: target.slug ?? targetFamilyId,
    faces,
    axes: mergedAxes(selected.map((item) => item.data)),
    coverFaceId: target.coverFaceId && faces.some((face) => face.id === target.coverFaceId)
      ? target.coverFaceId
      : faces.find((face) => face.weight === 400 && face.italic !== true)?.id ?? faces[0]?.id,
    status: 'ready',
    hidden: false,
    manualMerge: { version: MERGE_VERSION, mergeId, targetFamilyId, sourceFamilyIds: sourceIds, selectedFamilyIds: selectedIds, displayNamePending: true, requestedAt },
  };
  delete targetDoc.mergedInto;
  delete targetDoc.aliasOf;
  return { ok: true, value: {
    mergeId, targetFamilyId, targetDoc,
    aliasDocs: sourceIds.map((familyId) => ({ familyId, doc: { ...cleanCatalogDoc(byId.get(familyId)!), status: 'merged', hidden: true, mergedInto: targetFamilyId, aliasOf: targetFamilyId, manualMerge: { version: MERGE_VERSION, mergeId, targetFamilyId, displayNamePending: false, requestedAt } } })),
    operation: { id: mergeId, ownerId: uid, targetFamilyId, sourceFamilyIds: sourceIds, selectedFamilyIds: selectedIds, snapshots: selectedIds.map((familyId) => ({ familyId, data: byId.get(familyId)! })), undoExpiresAt, createdAt: requestedAt },
    undoExpiresAt,
    deletedFieldNames: STALE_ENRICHMENT_FIELDS,
  } };
}
