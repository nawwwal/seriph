import { FieldValue } from "firebase-admin/firestore";
import { familyFileBase } from "../storage/canonicalize";
import type { FontFamilyDoc } from "../models/catalog.models";
import type { MergeTarget } from "./mergeSplitFamiliesTypes";

export function mergedFamilyDoc(target: MergeTarget): FontFamilyDoc {
  const now = FieldValue.serverTimestamp() as unknown as string;
  return {
    ...(target.base ?? {}),
    id: target.docId,
    slug: target.slug,
    name: target.name,
    fileBase: target.fileBase || familyFileBase(target.name),
    ownerId: target.ownerId,
    category: target.category,
    faces: target.faces,
    coverFaceId: target.faces.find((face) => face.weight === 400 && !face.italic && !face.isVariable)?.id ?? target.faces[0]?.id,
    status: "ready",
    version: (target.base?.version ?? 1) + 1,
    updatedAt: now,
  };
}
