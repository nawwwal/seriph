import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions";
import { isVertexEnabled } from "../../ai/vertex/vertexClient";
import { buildPrompt, renderFamilySpecimen, isEnrichedAtCurrentVersion } from "../../ai/enrichFont";
import { FAMILIES_COLLECTION } from "../../storage/familyStore";
import { RC_KEYS, RC_DEFAULTS } from "../../config/rcKeys";
import { getConfigNumber } from "../../config/remoteConfig";
import type { FontFamilyDoc } from "../../models/catalog.models";
import { buildBatchCatalogKey } from "./key";
import { tagIngestsForBatch } from "./ingestJob";
import {
  JOBS_COLLECTION, SAFETY_SETTINGS, batchClient, analysisModelId,
  batchEnrichEnabled, batchBucket, batchGenerationConfig,
} from "./client";

/**
 * Collect families at `ready`, render their specimens, write one JSONL input
 * file, and submit a single Vertex batch prediction job. Marks each family
 * `enriching` and records a tracking doc in `batchJobs`.
 */
export async function submitPendingEnrichmentBatch(): Promise<{ submitted: number; jobName?: string }> {
  if (!batchEnrichEnabled() || !isVertexEnabled()) {
    logger.info("[batch] enrichment disabled (kill-switch); skipping submit.");
    return { submitted: 0 };
  }
  const db = getFirestore();
  const max = getConfigNumber(RC_KEYS.enrichBatchMax, Number(RC_DEFAULTS[RC_KEYS.enrichBatchMax]));
  const snap = await db.collection(FAMILIES_COLLECTION).where("status", "==", "ready").limit(max).get();
  const families = snap.docs
    .map((d) => ({ ...d.data(), id: d.id }) as FontFamilyDoc)
    .filter((f) => f.hidden !== true && !f.mergedInto && !f.aliasOf)
    .filter((f) => !isEnrichedAtCurrentVersion(f));
  if (!families.length) {
    logger.info("[batch] no pending families to enrich.");
    return { submitted: 0 };
  }

  const jobId = `enrich-${Date.now()}`;
  const leaseExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
  const lines: string[] = [];
  const slugs: string[] = [];
  const familyIds: string[] = [];
  for (const family of families) {
    const png = await renderFamilySpecimen(family);
    const parts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }> = [];
    if (png) parts.push({ inlineData: { mimeType: "image/png", data: png.toString("base64") } });
    parts.push({ text: buildPrompt(family, !!png, true, buildBatchCatalogKey(family.id, jobId, family.version ?? 1)) });
    lines.push(JSON.stringify({
      request: {
        contents: [{ role: "user", parts }],
        generationConfig: batchGenerationConfig(),
        safetySettings: SAFETY_SETTINGS,
      },
    }));
    slugs.push(family.slug);
    familyIds.push(family.id);
  }

  const bucket = batchBucket();
  const inputPath = `_batch/${jobId}/input.jsonl`;
  const outputPrefix = `_batch/${jobId}/output`;
  await getStorage().bucket(bucket).file(inputPath)
    .save(lines.join("\n"), { contentType: "application/x-jsonlines" });

  const job = await batchClient().batches.create({
    model: analysisModelId(),
    src: { gcsUri: [`gs://${bucket}/${inputPath}`], format: "jsonl" },
    config: { displayName: jobId, dest: { gcsUri: `gs://${bucket}/${outputPrefix}`, format: "jsonl" } },
  });

  const writer = db.batch();
  for (const family of families) {
    writer.set(
      db.collection(FAMILIES_COLLECTION).doc(family.id),
      {
        status: "enriching",
        enrichmentJobId: jobId,
        enrichmentJobVersion: family.version ?? 1,
        enrichmentLeaseExpiresAt: leaseExpiresAt,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }
  writer.set(db.collection(JOBS_COLLECTION).doc(jobId), {
    jobId, jobName: job.name, type: "analysis", state: job.state ?? "JOB_STATE_PENDING",
    slugs, familyIds, bucket, inputUri: `gs://${bucket}/${inputPath}`, outputPrefix, model: analysisModelId(),
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  await writer.commit();
  await tagIngestsForBatch(families, jobId);

  logger.info(`[batch] submitted ${families.length} families as ${job.name} (job ${jobId}).`);
  return { submitted: families.length, jobName: job.name ?? undefined };
}
