import { FieldValue, getFirestore, type Query, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import type { FontFamilyDoc } from "../models/catalog.models";
import { FAMILIES_COLLECTION } from "../storage/familyStore";
import { familySlug } from "../storage/canonicalize";
import { buildSearchDocument } from "../search/searchDocument";
import { currentSearchBackfillVersion } from "./backfillSearchVectors";
import { mergedFamilyDoc } from "./mergeSplitFamilyDoc";
import type { MergeArgs, SplitFamilyMergePlan } from "./mergeSplitFamiliesTypes";
import { catalogDocIdArg, unique } from "./mergeSplitFamiliesTypes";

const MERGE_VERSION = "2026-06-canonical-family-merge";
const DEFAULT_MAX_BATCH_WRITES = 50;

function familyFromSnapshot(doc: QueryDocumentSnapshot): FontFamilyDoc {
  return { ...doc.data(), id: doc.id, slug: (doc.data() as FontFamilyDoc).slug ?? doc.id } as FontFamilyDoc;
}

export async function listCatalogFamilies(args: MergeArgs): Promise<FontFamilyDoc[]> {
  const db = getFirestore();
  if (args.familyIds?.length) {
    const ids = unique(args.familyIds.flatMap((id) => [catalogDocIdArg(id, args.ownerId), id.trim(), familySlug(id)]));
    const refs = ids.map((id) => db.collection(FAMILIES_COLLECTION).doc(id));
    const snaps = await Promise.all(refs.map((ref) => ref.get()));
    const families = snaps.filter((snap) => snap.exists).map((snap) => ({ ...snap.data(), id: snap.id, slug: (snap.data() as FontFamilyDoc).slug ?? snap.id }) as FontFamilyDoc);
    return [...new Map(families.map((family) => [family.id, family])).values()];
  }

  let query: Query = db.collection(FAMILIES_COLLECTION);
  if (args.ownerId) query = query.where("ownerId", "==", args.ownerId);
  if (args.limit) query = query.limit(args.limit);
  return (await query.get()).docs.map(familyFromSnapshot);
}

export async function applyPlan(
  plan: SplitFamilyMergePlan,
  force: boolean,
  options: { maxBatchWrites?: number } = {}
): Promise<void> {
  if (plan.conflicts.length && !force) throw new Error(`Refusing to apply ${plan.conflicts.length} face conflicts without --force`);
  const db = getFirestore();
  const searchVersion = currentSearchBackfillVersion();
  const maxBatchWrites = options.maxBatchWrites ?? DEFAULT_MAX_BATCH_WRITES;
  let batch = db.batch();
  let writes = 0;
  const commit = async () => {
    if (writes === 0) return;
    await batch.commit();
    batch = db.batch();
    writes = 0;
  };

  for (const target of plan.targets) {
    const ref = db.collection(FAMILIES_COLLECTION).doc(target.docId);
    const doc = mergedFamilyDoc(target);
    const canonicalMerge = { version: MERGE_VERSION, sourceSlugs: target.sourceSlugs, aliases: target.aliases };
    batch.set(ref, {
      ...doc,
      ...buildSearchDocument({ ...doc, canonicalMerge }, searchVersion),
      hidden: false,
      mergedInto: FieldValue.delete(),
      aliasOf: FieldValue.delete(),
      mergedIntoId: FieldValue.delete(),
      aliasOfId: FieldValue.delete(),
      enrichment: FieldValue.delete(),
      text_vec: FieldValue.delete(),
      mood_vec: FieldValue.delete(),
      use_case_vec: FieldValue.delete(),
      image_vec: FieldValue.delete(),
      canonicalMerge: { ...canonicalMerge, mergedAt: FieldValue.serverTimestamp() },
    }, { merge: true });
    writes += 1;

    for (const aliasDocId of target.aliasDocIds) {
      batch.set(db.collection(FAMILIES_COLLECTION).doc(aliasDocId), {
        status: "merged",
        hidden: true,
        mergedInto: target.slug,
        aliasOf: target.slug,
        mergedIntoId: target.docId,
        aliasOfId: target.docId,
        searchText: FieldValue.delete(),
        searchTokens: FieldValue.delete(),
        searchMeta: FieldValue.delete(),
        enrichment: FieldValue.delete(),
        text_vec: FieldValue.delete(),
        mood_vec: FieldValue.delete(),
        use_case_vec: FieldValue.delete(),
        image_vec: FieldValue.delete(),
        canonicalMerge: {
          version: MERGE_VERSION,
          targetSlug: target.slug,
          mergedAt: FieldValue.serverTimestamp(),
        },
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      writes += 1;
    }
    if (writes >= maxBatchWrites) await commit();
  }
  await commit();
}
