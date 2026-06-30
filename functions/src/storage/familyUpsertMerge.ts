import { FieldValue } from "firebase-admin/firestore";
import type { CanonicalAxis, FontFamilyDoc } from "../models/catalog.models";
import type { UpsertFaceInput } from "./familyStore";
import { isCoverFace, nextFamilyStatusAfterFaceMerge } from "./familyStatus";

function mergeAxes(a: CanonicalAxis[] = [], b: CanonicalAxis[] = []): CanonicalAxis[] {
  const byTag = new Map<string, CanonicalAxis>();
  for (const ax of [...a, ...b]) byTag.set(ax.tag, ax);
  return [...byTag.values()];
}

export function newFamilyDoc(input: UpsertFaceInput, docId: string, now: FieldValue): FontFamilyDoc {
  return {
    id: docId,
    slug: input.slug,
    name: input.name,
    fileBase: input.fileBase,
    category: input.category,
    classification: input.classification,
    foundry: input.foundry,
    designer: input.designer,
    license: input.license,
    subsets: input.subsets,
    axes: input.familyAxes,
    faces: [input.face],
    styleCount: 1,
    coverFaceId: input.face.id,
    ownerId: input.ownerId,
    status: "ready",
    version: 1,
    createdAt: now as unknown as string,
    updatedAt: now as unknown as string,
  };
}

export function mergeFaceIntoFamily(existing: FontFamilyDoc, input: UpsertFaceInput, now: FieldValue): Partial<FontFamilyDoc> {
  const faces = [...(existing.faces ?? [])].filter((face) => face.id !== input.face.id);
  faces.push(input.face);
  faces.sort((a, b) => a.weight - b.weight || Number(a.italic) - Number(b.italic));
  return {
    name: existing.name || input.name,
    fileBase: existing.fileBase || input.fileBase,
    category: existing.category || input.category,
    classification: existing.classification ?? input.classification,
    foundry: existing.foundry ?? input.foundry,
    designer: existing.designer ?? input.designer,
    license: existing.license ?? input.license,
    subsets: input.subsets ?? existing.subsets,
    axes: mergeAxes(existing.axes, input.familyAxes),
    faces,
    styleCount: faces.length,
    coverFaceId: existing.coverFaceId && existing.faces?.some((face) => face.id === existing.coverFaceId && isCoverFace(face))
      ? existing.coverFaceId
      : (faces.find(isCoverFace)?.id ?? faces[0]?.id ?? input.face.id),
    ownerId: existing.ownerId ?? input.ownerId,
    status: nextFamilyStatusAfterFaceMerge(existing, input.face),
    version: (existing.version ?? 1) + 1,
    updatedAt: now as unknown as string,
  };
}
