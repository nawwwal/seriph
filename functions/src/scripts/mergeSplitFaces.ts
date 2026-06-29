import {
  canonicalFaceId,
  parseStyle,
  resolveCanonicalFontIdentity,
} from "../storage/canonicalize";
import type { FontFace, FontFamilyDoc } from "../models/catalog.models";
import type { MergeConflict, MergeTarget } from "./mergeSplitFamiliesTypes";
import { unique } from "./mergeSplitFamiliesTypes";

export function normalizeFace(
  source: FontFamilyDoc,
  face: FontFace
): { identity: ReturnType<typeof resolveCanonicalFontIdentity>; face: FontFace } {
  const identity = resolveCanonicalFontIdentity({
    familyName: source.name,
    subfamilyName: face.styleName || face.weightName,
    postScriptName: face.postScriptName,
    fullName: face.fullName,
    isVariable: face.isVariable,
  });
  const { weight, weightName, italic } = parseStyle(identity.styleName, face.weight);
  return {
    identity,
    face: {
      ...face,
      id: canonicalFaceId(identity.styleName, face.isVariable),
      styleName: identity.styleName,
      weight,
      weightName,
      italic,
    },
  };
}

export function sortFaces(faces: FontFace[]): FontFace[] {
  return [...faces].sort((a, b) => {
    if (a.isVariable !== b.isVariable) return a.isVariable ? 1 : -1;
    return a.weight - b.weight || Number(a.italic) - Number(b.italic) || a.id.localeCompare(b.id);
  });
}

export function addFace(target: MergeTarget, incoming: FontFace, sourceSlug: string, conflicts: MergeConflict[]): void {
  const existingIndex = target.faces.findIndex((face) => face.id === incoming.id);
  if (existingIndex === -1) {
    target.faces.push(incoming);
    return;
  }
  const existing = target.faces[existingIndex]!;
  if (existing.contentHash && incoming.contentHash && existing.contentHash === incoming.contentHash) return;
  conflicts.push({ targetSlug: target.slug, faceId: incoming.id, sources: unique([target.slug, sourceSlug]) });
}
