import {
  STALE_ENRICHMENT_FIELDS,
  type CatalogFace,
  type CatalogFamily,
  type FamilyInput,
  type FamilyLike,
  type MutationResult,
} from '@/lib/server/familyMutationTypes';

export function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function faceList(data: CatalogFamily): CatalogFace[] {
  return Array.isArray(data.faces)
    ? data.faces.filter((face): face is CatalogFace => isRecord(face) && typeof face.id === 'string' && face.id.trim().length > 0)
    : [];
}

export function isVisibleFamily(data: CatalogFamily): boolean {
  return data.status !== 'merged' && data.hidden !== true && typeof data.mergedInto !== 'string' && typeof data.aliasOf !== 'string';
}

export function isFamilyInput(family: FamilyLike): family is FamilyInput {
  return isRecord(family) && typeof family.familyId === 'string' && 'data' in family;
}

export function inputFamilyId(family: FamilyLike): string | null {
  if (isFamilyInput(family)) return family.familyId;
  return typeof family.slug === 'string' ? family.slug : typeof family.id === 'string' ? family.id : null;
}

export function inputFamilyData(family: FamilyLike): CatalogFamily | null {
  return isFamilyInput(family) ? family.data : family;
}

export function lookupFamilies(families: FamilyLike[]): Map<string, CatalogFamily> {
  const byId = new Map<string, CatalogFamily>();
  for (const family of families) {
    const familyId = inputFamilyId(family);
    const data = inputFamilyData(family);
    if (familyId && data) byId.set(familyId, { ...data, id: data.id ?? familyId, slug: data.slug ?? familyId });
  }
  return byId;
}

export function validateOwnedVisibleFamilies(
  uid: string,
  familyIds: string[],
  byId: Map<string, CatalogFamily>
): MutationResult<CatalogFamily[]> {
  const docs: CatalogFamily[] = [];
  for (const familyId of familyIds) {
    const data = byId.get(familyId);
    if (!data) return { ok: false, code: 'not_found', message: `Family ${familyId} was not found.` };
    if (data.ownerId !== uid) return { ok: false, code: 'forbidden', message: `Family ${familyId} is not owned by the current user.` };
    if (!isVisibleFamily(data)) return { ok: false, code: 'bad_request', message: `Family ${familyId} is not a visible family.` };
    docs.push(data);
  }
  return { ok: true, value: docs };
}

export function cleanCatalogDoc(data: CatalogFamily): CatalogFamily {
  const cleaned: CatalogFamily = { ...data };
  for (const field of STALE_ENRICHMENT_FIELDS) delete cleaned[field];
  return cleaned;
}
