import type { CatalogFace, CatalogFamily } from '@/lib/server/familyMutationTypes';
import { faceList } from '@/lib/server/familyMutationUtils';

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

export function mergeFaces(
  targetFamilyId: string,
  selectedFamilies: Array<{ familyId: string; data: CatalogFamily }>
): CatalogFace[] {
  const merged: CatalogFace[] = [];
  const usedIds = new Set<string>();
  const seenHashes = new Set<string>();

  for (const family of selectedFamilies) {
    for (const face of faceList(family.data)) {
      const hash = typeof face.contentHash === 'string' ? face.contentHash : null;
      if (hash && seenHashes.has(hash)) continue;

      const id = usedIds.has(face.id)
        ? nextFaceId(face.id, family.familyId === targetFamilyId ? 'target' : family.familyId, usedIds)
        : face.id;
      merged.push(id === face.id ? { ...face } : { ...face, id });
      usedIds.add(id);
      if (hash) seenHashes.add(hash);
    }
  }

  return merged;
}
