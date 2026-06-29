import type { FontFace, FontFamilyDoc } from '../models/catalog.models';

/** Is this the canonical "cover" face? (Regular, upright.) */
export const isCoverFace = (face: FontFace): boolean => face.weight === 400 && !face.italic;

/** Decide whether a face merge invalidates the current enrichment/search doc. */
export function nextFamilyStatusAfterFaceMerge(
  existing: FontFamilyDoc,
  incomingFace: FontFace
): FontFamilyDoc['status'] {
  if (existing.status !== 'enriched') return 'ready';
  const represented = existing.faces?.some((face) => {
    if (face.id !== incomingFace.id) return false;
    if (incomingFace.contentHash) return face.contentHash === incomingFace.contentHash;
    return true;
  });
  return represented ? 'enriched' : 'ready';
}
