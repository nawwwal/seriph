import { FieldValue, getFirestore, type DocumentSnapshot } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { ingestFont } from "../storage/ingest";
import { FAMILIES_COLLECTION } from "../storage/familyStore";
import { gfCategory } from "../storage/canonicalize";
import { catalogFamilyDocId } from "../storage/catalogIdentity";
import type { FontFamilyDoc } from "../models/catalog.models";
import { updateCatalogFamily } from "./migrateCatalogRepair";
import { buildLegacyEnrichment, hasCompletedOldSchemaMigration, isCatalogFamilyDoc } from "./migrateLegacyEnrichment";
import { collectLegacyFontSources, legacyTargetSlug, ownerFromLegacyPath } from "./migrateLegacySources";
import { OLD_SCHEMA_MIGRATION_VERSION, isRecord, stringField, type MigrationArgs } from "./migrateOldSchemaTypes";

export async function migrateLegacyDoc(doc: DocumentSnapshot, args: MigrationArgs): Promise<"migrated" | "skipped" | "catalog"> {
  if (!doc.exists) return "skipped";
  const data = doc.data();
  if (isCatalogFamilyDoc(data)) return "catalog";
  if (!args.force && hasCompletedOldSchemaMigration(data)) return "skipped";
  const ownerId = args.ownerId ?? ownerFromLegacyPath(doc.ref.path) ?? (isRecord(data) ? stringField(data, "ownerId") : undefined);
  if (!ownerId) throw new Error(`${doc.ref.path} has no ownerId`);
  const sources = collectLegacyFontSources(data);
  if (!sources.length) throw new Error(`${doc.ref.path} has no legacy font storage paths`);
  const targetSlug = legacyTargetSlug(data, doc.id);
  if (args.dryRun) {
    console.log(`would migrate ${doc.ref.path} -> ${FAMILIES_COLLECTION}/${targetSlug} (${sources.length} fonts)`);
    return "migrated";
  }

  let targetFamily: FontFamilyDoc | undefined;
  for (const source of sources) {
    const bucket = source.bucketName ? getStorage().bucket(source.bucketName) : getStorage().bucket();
    const [fileBuffer] = await bucket.file(source.storagePath).download();
    const result = await ingestFont({ fileBuffer, originalFilename: source.filename, ownerId });
    if (result?.family) targetFamily = result.family;
  }

  const ref = getFirestore().collection(FAMILIES_COLLECTION).doc(targetFamily?.id ?? catalogFamilyDocId(ownerId, targetSlug));
  const snap = await ref.get();
  const family = snap.exists ? ({ ...snap.data(), id: snap.id } as FontFamilyDoc) : undefined;
  if (!family) throw new Error(`target catalog family ${ref.path} was not written`);
  const fallbackCategory = gfCategory(isRecord(data) ? stringField(data, "classification") : undefined);
  const enrichment = buildLegacyEnrichment(data, family.category ?? fallbackCategory);
  await updateCatalogFamily(family, enrichment && (!family.enrichment || args.force) ? { enrichment } : {}, args.force, args.recomputeVectors);
  await doc.ref.set({
    oldSchemaMigration: {
      version: OLD_SCHEMA_MIGRATION_VERSION,
      targetFamilyId: ref.id,
      targetPath: ref.path,
      migratedAt: FieldValue.serverTimestamp(),
    },
  }, { merge: true });
  console.log(`migrated ${doc.ref.path} -> ${ref.path}`);
  return "migrated";
}
