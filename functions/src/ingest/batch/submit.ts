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
import { ENRICHMENT_JOBS_COLLECTION } from "../../enrichment/jobs/jobStore";
import { buildProviderRun, type ProviderJob } from "../../enrichment/provider/buildInput";
import { providerJobId } from "../../enrichment/provider/expectedSet";
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

export interface ProviderRunRecord {
  id: string;
  providerJobName: string;
  expectedJobIds: string[];
  inputUri: string;
  outputPrefix: string;
  state: string;
}

function providerError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function returnJobsToRetrying(db: FirebaseFirestore.Firestore, jobIds: readonly string[], error: unknown): Promise<void> {
  const message = providerError(error);
  const writer = db.batch();
  for (const jobId of jobIds) writer.set(db.collection(ENRICHMENT_JOBS_COLLECTION).doc(jobId), {
    state: "retrying", failureCode: message, failureReasons: [message], updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await writer.commit();
}

async function submitProviderJobs(db: FirebaseFirestore.Firestore, selectedJobs: readonly EnrichmentJob[]) {
  const families = new Map<string, FontFamilyDoc>();
  await Promise.all(selectedJobs.map(async (job) => {
    const snap = await db.collection(FAMILIES_COLLECTION).doc(job.familyId).get();
    if (snap.exists) families.set(job.familyId, { ...snap.data(), id: snap.id } as FontFamilyDoc);
  }));
  const run = await buildProviderRun(selectedJobs as readonly ProviderJob[], {
    loadFamily: async (job) => families.get(String(job.familyId)),
    render: async (_job, family) => renderFamilySpecimen(family),
    generationConfig: batchGenerationConfig(),
    safetySettings: SAFETY_SETTINGS,
  });
  if (!run.expectedJobIds.length) return { selected: selectedJobs.length, submitted: 0, rejected: run.rejected.length };

  const bucket = batchBucket();
  const inputPath = `_batch/${run.id}/input.jsonl`;
  const outputPrefix = `_batch/${run.id}/output`;
  const inputUri = `gs://${bucket}/${inputPath}`;
  let providerJob: { name?: string; state?: string };
  try {
    await getStorage().bucket(bucket).file(inputPath).save(run.rows.join("\n"), { contentType: "application/x-jsonlines" });
    providerJob = await batchClient().batches.create({
      model: analysisModelId(), src: { gcsUri: [inputUri], format: "jsonl" },
      config: { displayName: run.id, dest: { gcsUri: `gs://${bucket}/${outputPrefix}`, format: "jsonl" } },
    }) as typeof providerJob;
  } catch (error) {
    try { await returnJobsToRetrying(db, run.expectedJobIds, error); } catch { /* preserve the provider error */ }
    throw error;
  }

  const record: ProviderRunRecord = {
    id: run.id, providerJobName: providerJob.name ?? "", expectedJobIds: run.expectedJobIds,
    inputUri, outputPrefix, state: providerJob.state ?? "JOB_STATE_PENDING",
  };
  const submittedFamilies = selectedJobs
    .filter((job) => run.expectedJobIds.includes(providerJobId(job)))
    .map((job) => families.get(job.familyId))
    .filter((family): family is FontFamilyDoc => Boolean(family));
  const leaseExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await db.runTransaction(async (tx) => {
    tx.set(db.collection(JOBS_COLLECTION).doc(record.id), {
      ...record, jobId: record.id, jobName: record.providerJobName, type: "analysis", bucket,
      slugs: submittedFamilies.map((family) => family.slug), familyIds: submittedFamilies.map((family) => family.id),
      model: analysisModelId(), createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    for (const job of selectedJobs) {
      if (!run.expectedJobIds.includes(providerJobId(job))) continue;
      tx.set(db.collection(ENRICHMENT_JOBS_COLLECTION).doc(providerJobId(job)), {
        state: "submitted", providerRunId: record.id, providerJobName: record.providerJobName,
        submittedAt: FieldValue.serverTimestamp(), leaseExpiresAt,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      const family = families.get(job.familyId);
      if (family) tx.set(db.collection(FAMILIES_COLLECTION).doc(family.id), {
        status: "enriching", enrichmentJobId: record.id, enrichmentJobVersion: job.familyVersion ?? family.version ?? 1,
        enrichmentLeaseExpiresAt: leaseExpiresAt, updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  });
  await tagIngestsForBatch(submittedFamilies, record.id);
  return { selected: selectedJobs.length, submitted: run.expectedJobIds.length, rejected: run.rejected.length, jobName: record.providerJobName || undefined };
}

export async function submitPendingEnrichmentBatch(selectedJobs?: readonly EnrichmentJob[]): Promise<{ selected: number; submitted: number; rejected: number; jobName?: string }> {
  if (!batchEnrichEnabled() || !isVertexEnabled()) {
    logger.info("[batch] enrichment disabled (kill-switch); skipping submit. selected 0, submitted 0, rejected 0.");
    return { selected: 0, submitted: 0, rejected: 0 };
  }
  const db = getFirestore();
  if (selectedJobs) return submitProviderJobs(db, selectedJobs);
  const max = getConfigNumber(RC_KEYS.enrichBatchMax, Number(RC_DEFAULTS[RC_KEYS.enrichBatchMax]));
  const families = (await db.collection(FAMILIES_COLLECTION).where("status", "==", "ready").limit(max).get()).docs
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
