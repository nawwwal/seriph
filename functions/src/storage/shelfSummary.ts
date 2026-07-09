import type { CatalogCoverFace, FontFace } from "../models/catalog.models";
import { isCoverFace } from "./familyStatus";

export function coverFaceIdFor(faces: FontFace[], preferredId?: string): string | undefined {
  if (preferredId && faces.some((face) => face.id === preferredId && isCoverFace(face))) return preferredId;
  return faces.find(isCoverFace)?.id ?? faces[0]?.id;
}

export function coverFaceFor(faces: FontFace[], preferredId?: string): CatalogCoverFace | undefined {
  const coverId = coverFaceIdFor(faces, preferredId);
  const face = faces.find((item) => item.id === coverId) ?? faces[0];
  if (!face) return undefined;
  return {
    id: face.id,
    subfamily: face.styleName || face.weightName || "Regular",
    weight: face.weight,
    italic: face.italic,
    isVariable: face.isVariable,
    cdnUrl: face.woff2?.url,
  };
}

export function hasVariableFace(faces: FontFace[]): boolean {
  return faces.some((face) => face.isVariable);
}
