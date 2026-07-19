import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions";
import { isVertexEnabled } from "../../ai/vertex/vertexClient";
import { buildPrompt, renderFamilySpecimen, isEnrichedAtCurrentVersion } from "../../ai/enrichFont";
import { FAMILIES_COLLECTION } from "../../storage/familyStore";
import { RC_KEYS, RC_DEFAULTS } from "../../config/rcKeys";
import { getConfigNumber } from "../../config/remoteConfig";
import type { FontFamilyDoc } from "../../models/catalog.models";
import { buildSubmissionCandidates, type RejectedFamily } from "../../enrichment/preflight";
import type { EnrichmentJob } from "../../enrichment/jobs/jobTypes";
export { buildSubmissionCandidates } from "../../enrichment/preflight";
import { buildBatchCatalogKey } from "./key";
import { tagIngestsForBatch } from "./ingestJob";
import { JOBS_COLLECTION, SAFETY_SETTINGS, batchClient, analysisModelId, batchEnrichEnabled, batchBucket, batchGenerationConfig } from "./client";

async function persistRejections(db: FirebaseFirestore.Firestore, rejected: RejectedFamily[]): Promise<void> {
  if (!rejected.length) return;
  const writer = db.batch();
  for (const rejection of rejected) writer.set(db.collection(FAMILIES_COLLECTION).doc(rejection.family.id), {
    status: "failed", enrichmentSubmissionRejection: {
      code: rejection.code, reasons: rejection.reasons, message: rejection.message, stack: rejection.stack,
    }, updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await writer.commit();
}

export async function submitPendingEnrichmentBatch(selectedJobs?: readonly EnrichmentJob[]): Promise<{ selected: number; submitted: number; rejected: number; jobName?: string }> {
  if (!batchEnrichEnabled() || !isVertexEnabled()) {
    logger.info("[batch] enrichment disabled (kill-switch); skipping submit. selected 0, submitted 0, rejected 0.");
    return { selected: 0, submitted: 0, rejected: 0 };
  }
  const db = getFirestore();
  const max = getConfigNumber(RC_KEYS.enrichBatchMax, Number(RC_DEFAULTS[RC_KEYS.enrichBatchMax]));
  const families = selectedJobs
    ? (await Promise.all(selectedJobs.map(async (job) => {
      const snap = await db.collection(FAMILIES_COLLECTION).doc(job.familyId).get();
      return snap.exists ? ({ ...snap.data(), id: snap.id } as FontFamilyDoc) : undefined;
    }))).filter((family): family is FontFamilyDoc => Boolean(family))
    : (await db.collection(FAMILIES_COLLECTION).where("status", "==", "ready").limit(max).get()).docs
      .map((d) => ({ ...d.data(), id: d.id }) as FontFamilyDoc)
      .filter((f) => !isEnrichedAtCurrentVersion(f));
  if (!families.length) {
    logger.info("[batch] no pending families to enrich. selected 0, submitted 0, rejected 0.");
    return { selected: 0, submitted: 0, rejected: 0 };
  }
  const candidates = await buildSubmissionCandidates(families, renderFamilySpecimen);
  await persistRejections(db, candidates.rejected);
  if (!candidates.accepted.length) {
    logger.info(`[batch] selected ${families.length}, submitted 0, rejected ${candidates.rejected.length}.`);
    return { selected: families.length, submitted: 0, rejected: candidates.rejected.length };
  }
  const jobId = `enrich-${Date.now()}`;
  const leaseExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
  const lines: string[] = [];
  const slugs: string[] = [];
  const familyIds: string[] = [];
  for (const { family, png } of candidates.accepted) {
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
  for (const { family } of candidates.accepted) {
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
  const submittedFamilies = candidates.accepted.map(({ family }) => family);
  await tagIngestsForBatch(submittedFamilies, jobId);

  logger.info(`[batch] selected ${families.length}, submitted ${submittedFamilies.length}, rejected ${candidates.rejected.length} as ${job.name} (job ${jobId}).`);
  return { selected: families.length, submitted: submittedFamilies.length, rejected: candidates.rejected.length, jobName: job.name ?? undefined };
}
