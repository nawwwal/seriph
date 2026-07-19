import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { parseAnalysis, buildEnrichmentUpdate } from "../../ai/enrichFont";
import { FAMILIES_COLLECTION } from "../../storage/familyStore";
import type { FontFamilyDoc, FontEnrichment } from "../../models/catalog.models";
import { parseBatchCatalogKey } from "./key";
import { catalogKeyFromOutputRow, textFromOutputRow, type BatchOutputRow } from "./outputRows";
export { readOutputLines } from "./outputRows";

/** Mark every ingest pointing at a family as fully complete (best-effort). */
export async function finalizeIngestsForFamily(familyId: string, providerRunId?: string, familyVersion?: number): Promise<void> {
  const db = getFirestore();
  try {
    let query = db.collectionGroup("ingests").where("familyId", "==", familyId);
    if (providerRunId && familyVersion !== undefined) {
      query = query.where("enrichmentJobId", "==", providerRunId).where("enrichmentJobVersion", "==", familyVersion);
    }
    const snap = await query.get();
    await Promise.all(
      snap.docs.map((d) =>
        d.ref.update({
          analysisState: "complete",
          status: "completed",
          enrichmentJobId: FieldValue.delete(),
          enrichmentJobVersion: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        })
      )
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`[batch] failed to finalize ingests for ${familyId}`, { message });
  }
}

/** Apply one batch output row to its family: parse analysis, embed inline, write. */
export async function applyOutputRow(row: BatchOutputRow): Promise<boolean> {
  const catalogKey = catalogKeyFromOutputRow(row);
  if (!catalogKey) {
    logger.warn("[batch] output row missing Catalog-Key; cannot map to family.");
    return false;
  }
  const key = parseBatchCatalogKey(catalogKey);
  if (!key) {
    logger.warn("Ignoring enrichment output with a non-canonical catalog key", { catalogKey });
    return false;
  }
  const providerRunId = key.providerRunId ?? key.jobId;
  const familyVersion = key.familyVersion ?? key.version;
  const db = getFirestore();
  const ref = db.collection(FAMILIES_COLLECTION).doc(key.familyId);
  const snap = await ref.get();
  if (!snap.exists) return false;
  const family = { ...snap.data(), id: snap.id } as FontFamilyDoc;
  if (family.status === "merged" || family.hidden === true || family.mergedInto || family.aliasOf) {
    logger.info(`[batch] skipping merged alias ${catalogKey}.`);
    return false;
  }
  if (providerRunId && (family.enrichmentJobId !== providerRunId || family.enrichmentJobVersion !== familyVersion)) {
    logger.warn("[batch] stale output row ignored", { familyId: key.familyId, providerRunId });
    return false;
  }

  const text = textFromOutputRow(row);
  const enrichment: FontEnrichment | null = parseAnalysis(family, text);
  if (!enrichment) {
    await ref.set({
      status: "ready",
      enrichmentJobId: FieldValue.delete(),
      enrichmentJobVersion: FieldValue.delete(),
      enrichmentLeaseExpiresAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return false;
  }

  const update = await buildEnrichmentUpdate(family, enrichment);
  await ref.set({
    ...update,
    enrichmentJobId: FieldValue.delete(),
    enrichmentJobVersion: FieldValue.delete(),
    enrichmentLeaseExpiresAt: FieldValue.delete(),
  }, { merge: true });
  await finalizeIngestsForFamily(family.id, providerRunId, familyVersion);
  return true;
}
