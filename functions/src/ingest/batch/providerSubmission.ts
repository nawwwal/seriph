import { getStorage } from "firebase-admin/storage";
import { renderFamilySpecimen } from "../../ai/enrichFont";
import { FAMILIES_COLLECTION } from "../../storage/familyStore";
import { catalogFamilyDocId } from "../../storage/catalogIdentity";
import type { FontFamilyDoc } from "../../models/catalog.models";
import type { EnrichmentJob } from "../../enrichment/jobs/jobTypes";
import { buildProviderRun, type ProviderJob } from "../../enrichment/provider/buildInput";
import { providerJobId } from "../../enrichment/provider/expectedSet";
import { tagIngestsForBatch } from "./ingestJob";
import { SAFETY_SETTINGS, analysisModelId, batchBucket, batchClient, batchGenerationConfig } from "./client";
import {
  finalizeProviderFailure, finalizeProviderSubmission, recordProviderSubmission, reconcileProviderSubmission, type ProviderRunRecord,
} from "./submissionStore";
import { persistRejectedJobs, persistSubmissionIntent } from "./submissionIntent";
import type { Firestore } from "firebase-admin/firestore";

function existingRunId(jobs: readonly EnrichmentJob[]): string | undefined {
  const ids = jobs.map((job) => (job as EnrichmentJob & { providerRunId?: string }).providerRunId).filter(Boolean);
  return ids.length && ids.every((id) => id === ids[0]) ? ids[0] : undefined;
}

export async function submitProviderJobs(
  db: Firestore, selectedJobs: readonly EnrichmentJob[],
): Promise<{ selected: number; submitted: number; rejected: number; jobName?: string }> {
  const families = new Map<string, FontFamilyDoc>();
  await Promise.all(selectedJobs.map(async (job) => {
    const snap = await db.collection(FAMILIES_COLLECTION).doc(catalogFamilyDocId(job.ownerId, job.familyId)).get();
    if (snap.exists) families.set(job.familyId, { ...snap.data(), id: snap.id } as FontFamilyDoc);
  }));
  const run = await buildProviderRun(selectedJobs as readonly ProviderJob[], {
    loadFamily: async (job) => families.get(String(job.familyId)),
    render: async (_job, family) => renderFamilySpecimen(family),
    providerRunId: existingRunId(selectedJobs),
    generationConfig: batchGenerationConfig(), safetySettings: SAFETY_SETTINGS,
  });
  if (!run.expectedJobIds.length) {
    await persistRejectedJobs(db, run.id, run.rejected);
    return { selected: selectedJobs.length, submitted: 0, rejected: run.rejected.length };
  }
  const bucket = batchBucket(); const inputPath = `_batch/${run.id}/input.jsonl`;
  const outputPrefix = `_batch/${run.id}/output`;
  const record: ProviderRunRecord = {
    id: run.id, providerJobName: "", expectedJobIds: run.expectedJobIds,
    inputUri: `gs://${bucket}/${inputPath}`, outputPrefix, state: "SUBMISSION_SUBMITTING",
    submissionState: "submitting", bucket,
    slugs: selectedJobs.filter((job) => run.expectedJobIds.includes(providerJobId(job)))
      .map((job) => families.get(job.familyId)?.slug).filter((slug): slug is string => Boolean(slug)),
    familyIds: selectedJobs.filter((job) => run.expectedJobIds.includes(providerJobId(job))).map((job) => job.familyId),
  };
  const submittedFamilies = selectedJobs
    .filter((job) => run.expectedJobIds.includes(providerJobId(job)))
    .map((job) => families.get(job.familyId)).filter((family): family is FontFamilyDoc => Boolean(family));
  const leaseExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
  const intent = await persistSubmissionIntent(db, record, selectedJobs, submittedFamilies, run.rejected, leaseExpiresAt);
  if (intent === "existing") {
    if (!await reconcileProviderSubmission(db, run.id)) throw new Error(`provider submission needs reconciliation: ${run.id}`);
    return { selected: selectedJobs.length, submitted: run.expectedJobIds.length, rejected: run.rejected.length };
  }
  try {
    await getStorage().bucket(bucket).file(inputPath).save(run.rows.join("\n"), { contentType: "application/x-jsonlines" });
  } catch (error) {
    await finalizeProviderFailure(db, run.id, error, "input");
    throw error;
  }
  let providerJob: { name?: string; state?: string };
  try {
    providerJob = await batchClient().batches.create({
      model: analysisModelId(), src: { gcsUri: [record.inputUri], format: "jsonl" },
      config: { displayName: run.id, dest: { gcsUri: `gs://${bucket}/${outputPrefix}`, format: "jsonl" } },
    }) as typeof providerJob;
  } catch (error) {
    await finalizeProviderFailure(db, run.id, error, "provider");
    throw error;
  }
  try {
    await recordProviderSubmission(db, run.id, { name: providerJob.name ?? "", state: providerJob.state });
    await finalizeProviderSubmission(db, run.id);
  } catch (error) {
    await finalizeProviderFailure(db, run.id, error, "provider");
    throw error;
  }
  try { await tagIngestsForBatch(submittedFamilies, run.id); } catch { /* durable submission already won */ }
  return {
    selected: selectedJobs.length, submitted: run.expectedJobIds.length,
    rejected: run.rejected.length, jobName: providerJob.name || undefined,
  };
}
