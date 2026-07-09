import type { CatalogFace } from '@/lib/server/familyMutationTypes';

function isCoverFace(face: CatalogFace): boolean {
  return face.weight === 400 && face.italic !== true && face.isVariable !== true;
}

export function coverFaceIdFor(faces: CatalogFace[], preferredId?: string): string | undefined {
  if (preferredId && faces.some((face) => face.id === preferredId && isCoverFace(face))) return preferredId;
  return faces.find(isCoverFace)?.id ?? faces[0]?.id;
}

export function coverFaceFor(faces: CatalogFace[], preferredId?: string): Record<string, unknown> | undefined {
  const coverId = coverFaceIdFor(faces, preferredId);
  const face = faces.find((item) => item.id === coverId) ?? faces[0];
  const woff2 = face?.woff2 as { url?: unknown } | undefined;
  if (!face) return undefined;
  return {
    id: face.id,
    subfamily: typeof face.styleName === 'string' ? face.styleName : 'Regular',
    weight: typeof face.weight === 'number' ? face.weight : 400,
    italic: face.italic === true,
    isVariable: face.isVariable === true,
    cdnUrl: typeof woff2?.url === 'string' ? woff2.url : undefined,
  };
}
