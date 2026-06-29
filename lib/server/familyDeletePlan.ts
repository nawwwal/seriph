import type {
  CatalogFamily,
  FamilyLike,
  HardDeletePlan,
  MutationResult,
} from '@/lib/server/familyMutationTypes';
import {
  faceList,
  inputFamilyData,
  inputFamilyId,
  lookupFamilies,
  unique,
  validateOwnedVisibleFamilies,
} from '@/lib/server/familyMutationUtils';

function storagePathsFor(data: CatalogFamily): string[] {
  const paths = new Set<string>();
  for (const face of faceList(data)) {
    if (typeof face.woff2?.storagePath === 'string') paths.add(face.woff2.storagePath);
    if (typeof face.original?.storagePath === 'string') paths.add(face.original.storagePath);
  }
  return [...paths];
}

export function buildFamilyHardDeletePlan({
  uid,
  familyIds,
  selectedFamilies,
  aliasFamilies,
}: {
  uid: string;
  familyIds: string[];
  selectedFamilies: FamilyLike[];
  aliasFamilies: FamilyLike[];
}): MutationResult<HardDeletePlan> {
  const selectedIds = unique(familyIds);
  if (selectedIds.length === 0) return { ok: false, code: 'bad_request', message: 'Select at least one family to delete.' };

  const selectedById = lookupFamilies(selectedFamilies);
  const validation = validateOwnedVisibleFamilies(uid, selectedIds, selectedById);
  if (!validation.ok) return validation;

  const docs = new Map<string, CatalogFamily>();
  for (const familyId of selectedIds) docs.set(familyId, selectedById.get(familyId)!);
  for (const alias of aliasFamilies) {
    const familyId = inputFamilyId(alias);
    const data = inputFamilyData(alias);
    if (!familyId || !data || data.ownerId !== uid) continue;
    const target = typeof data.mergedInto === 'string' ? data.mergedInto : data.aliasOf;
    if (typeof target === 'string' && selectedIds.includes(target)) docs.set(familyId, data);
  }

  const storagePaths = new Set<string>();
  for (const data of docs.values()) {
    for (const path of storagePathsFor(data)) storagePaths.add(path);
  }
  return { ok: true, value: { docIds: [...docs.keys()], storagePaths: [...storagePaths] } };
}
