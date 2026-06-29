/**
 * Family document store. Families live in `fontfamilies/{slug}` with an
 * `ownerId` field; a face is merged transactionally (enrichment/vectors kept).
 */
import { getFirestore, FieldValue, Firestore } from 'firebase-admin/firestore';
import type { GfCategory } from './canonicalize';
import type { CanonicalAxis, FontFace, FontFamilyDoc } from '../models/catalog.models';

export const FAMILIES_COLLECTION = 'fontfamilies';

export interface UpsertFaceInput {
  slug: string;
  name: string;
  fileBase: string;
  category: GfCategory;
  classification?: string;
  foundry?: string;
  designer?: string;
  license?: string;
  subsets?: string[];
  ownerId?: string;
  familyAxes?: CanonicalAxis[];
  face: FontFace;
}

function mergeAxes(a: CanonicalAxis[] = [], b: CanonicalAxis[] = []): CanonicalAxis[] {
  const byTag = new Map<string, CanonicalAxis>();
  for (const ax of [...a, ...b]) byTag.set(ax.tag, ax);
  return [...byTag.values()];
}

/** Is this the canonical "cover" face? (Regular, upright.) */
const isCover = (face: FontFace): boolean => face.weight === 400 && !face.italic;

/** Decide whether a face merge invalidates the current enrichment/search doc. */
export function nextFamilyStatusAfterFaceMerge(existing: FontFamilyDoc, incomingFace: FontFace): FontFamilyDoc['status'] {
  if (existing.status !== 'enriched') return 'ready';

  const represented = existing.faces?.some((face) => {
    if (face.id !== incomingFace.id) return false;
    if (incomingFace.contentHash) return face.contentHash === incomingFace.contentHash;
    return true;
  });

  return represented ? 'enriched' : 'ready';
}

/** Create or update the family doc, merging in one face. Returns the resulting doc. */
export async function upsertFace(
  input: UpsertFaceInput,
  db: Firestore = getFirestore()
): Promise<FontFamilyDoc> {
  const ref = db.collection(FAMILIES_COLLECTION).doc(input.slug);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = FieldValue.serverTimestamp();
    if (!snap.exists) {
      const doc: FontFamilyDoc = {
        id: input.slug,
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
        coverFaceId: input.face.id,
        ownerId: input.ownerId,
        status: 'ready',
        version: 1,
        createdAt: now as unknown as string,
        updatedAt: now as unknown as string,
      };
      tx.set(ref, doc);
      return doc;
    }

    const existing = snap.data() as FontFamilyDoc;
    const faces = [...(existing.faces ?? [])].filter((f) => f.id !== input.face.id);
    faces.push(input.face);
    faces.sort((a, b) => a.weight - b.weight || Number(a.italic) - Number(b.italic));

    const coverFaceId =
      existing.coverFaceId && existing.faces?.some((f) => f.id === existing.coverFaceId && isCover(f))
        ? existing.coverFaceId
        : (faces.find(isCover)?.id ?? faces[0]?.id ?? input.face.id);

    const merged: Partial<FontFamilyDoc> = {
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
      coverFaceId,
      ownerId: existing.ownerId ?? input.ownerId,
      status: nextFamilyStatusAfterFaceMerge(existing, input.face),
      version: (existing.version ?? 1) + 1,
      updatedAt: now as unknown as string,
    };
    tx.set(ref, merged, { merge: true });
    return { ...existing, ...merged } as FontFamilyDoc;
  });
}
