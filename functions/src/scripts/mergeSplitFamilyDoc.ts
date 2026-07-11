import { FieldValue } from "firebase-admin/firestore";
import { familyFileBase } from "../storage/canonicalize";
import type { FontFamilyDoc } from "../models/catalog.models";
import type { MergeTarget } from "./mergeSplitFamiliesTypes";
import { coverFaceFor, coverFaceIdFor, hasVariableFace } from "../storage/shelfSummary";

export function mergedFamilyDoc(target: MergeTarget): FontFamilyDoc {
  const now = FieldValue.serverTimestamp() as unknown as string;
  const coverFaceId = coverFaceIdFor(target.faces);
  return {
    ...(target.base ?? {}),
    id: target.docId,
    slug: target.slug,
    name: target.name,
    fileBase: target.fileBase || familyFileBase(target.name),
    ownerId: target.ownerId,
    category: target.category,
    faces: target.faces,
    styleCount: target.faces.length,
    isVariable: hasVariableFace(target.faces),
    coverFaceId,
    coverFace: coverFaceFor(target.faces, coverFaceId),
    hidden: false,
    status: "ready",
    version: (target.base?.version ?? 1) + 1,
    updatedAt: now,
  };
}
