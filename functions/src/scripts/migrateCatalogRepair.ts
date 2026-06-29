import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { catalogFamilyDocIdFor } from "../storage/catalogIdentity";
import { FAMILIES_COLLECTION } from "../storage/familyStore";
import type { FontFamilyDoc } from "../models/catalog.models";
import { buildBackfillUpdate, currentSearchBackfillVersion, shouldBackfillFamily } from "./backfillSearchVectors";
import { repairFamilyVariableState, isCatalogFamilyDoc } from "./migrateLegacyEnrichment";
import { listCatalogDocs } from "./migrateOldSchemaQueries";
import type { MigrationArgs } from "./migrateOldSchemaTypes";

export async function updateCatalogFamily(
  family: FontFamilyDoc,
  patch: Partial<FontFamilyDoc>,
  force: boolean,
  recomputeVectors: boolean
): Promise<boolean> {
  const ref = getFirestore().collection(FAMILIES_COLLECTION).doc(catalogFamilyDocIdFor(family));
  const repaired = repairFamilyVariableState({ ...family, ...patch });
  const nextFamily = repaired.family;
  const update: Record<string, unknown> = repaired.changed
    ? { faces: nextFamily.faces, axes: nextFamily.axes ?? FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }
    : {};
  if (patch.enrichment) {
    update.enrichment = patch.enrichment;
    update.status = "enriched";
  }
  const version = currentSearchBackfillVersion();
  if (recomputeVectors && shouldBackfillFamily(nextFamily, version, force || repaired.changed || Boolean(patch.enrichment))) {
    Object.assign(update, await buildBackfillUpdate(nextFamily));
  }
  if (Object.keys(update).length === 0) return false;
  await ref.set(update, { merge: true });
  return true;
}

export async function repairCatalogDocs(args: MigrationArgs): Promise<number> {
  let updated = 0;
  for (const doc of await listCatalogDocs(args)) {
    if (!doc.exists) continue;
    const data = doc.data();
    if (!isCatalogFamilyDoc(data)) continue;
    const family = { ...data, id: doc.id, slug: data.slug ?? doc.id };
    if (args.dryRun) {
      const repaired = repairFamilyVariableState(family);
      const version = currentSearchBackfillVersion();
      if (repaired.changed || (args.recomputeVectors && shouldBackfillFamily(repaired.family, version, args.force))) {
        updated += 1;
        console.log(`would repair/reindex ${doc.ref.path}`);
      }
      continue;
    }
    if (await updateCatalogFamily(family, {}, args.force, args.recomputeVectors)) updated += 1;
  }
  return updated;
}
