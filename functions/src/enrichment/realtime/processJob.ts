import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { buildPrompt, buildEnrichmentUpdate, parseAnalysis, renderFamilySpecimen } from "../../ai/enrichFont";
import type { FontFamilyDoc } from "../../models/catalog.models";
import { catalogFamilyDocId } from "../../storage/catalogIdentity";
import { FAMILIES_COLLECTION } from "../../storage/familyStore";
import { analysisModelId, batchClient, batchGenerationConfig, SAFETY_SETTINGS } from "../../ingest/batch/client";
import { claimEnrichmentJob, enrichmentJobRef, releaseClaimedEnrichmentJob, updateClaimedEnrichmentJob } from "../jobs/jobStore";
import type { EnrichmentJob } from "../jobs/jobTypes";
import { retryState } from "../jobs/retryPolicy";

const failureMessage = (error: unknown) => error instanceof Error ? error.message : "realtime_enrichment_failed";

export async function processRealtimeEnrichmentJob(db: Firestore, job: EnrichmentJob): Promise<boolean> {
  const familyRef = db.collection(FAMILIES_COLLECTION).doc(catalogFamilyDocId(job.ownerId, job.familyId));
  const claimed = await claimEnrichmentJob(db, job.jobId);
  if (!claimed) return false;
  const jobRef = enrichmentJobRef(db, claimed.jobId);
  const familySnap = await familyRef.get();
  if (!familySnap.exists) {
    await releaseClaimedEnrichmentJob(db, claimed, "family_missing", { state: "failed", attempt: Number(claimed.attempt ?? 0), delayMs: null });
    return false;
  }
  const family = { ...familySnap.data(), id: familySnap.id } as FontFamilyDoc;
  if (family.version !== claimed.familyVersion || family.hidden || family.status === "merged") {
    await releaseClaimedEnrichmentJob(db, claimed, "family_stale", { state: "failed", attempt: Number(claimed.attempt ?? 0), delayMs: null });
    return false;
  }
  if (!(await updateClaimedEnrichmentJob(db, claimed, "analyzing"))) return false;
  try {
    const specimen = await renderFamilySpecimen(family);
    const parts: Array<Record<string, unknown>> = [];
    if (specimen) parts.push({ inlineData: { mimeType: "image/png", data: specimen.toString("base64") } });
    parts.push({ text: buildPrompt(family, Boolean(specimen)) });
    const response = await batchClient().models.generateContent({
      model: analysisModelId(), contents: [{ role: "user", parts }],
      config: { ...batchGenerationConfig(), safetySettings: SAFETY_SETTINGS },
    } as never);
    const enrichment = parseAnalysis(family, response.text);
    if (!enrichment) throw new Error("invalid_model_output");
    const update = await buildEnrichmentUpdate(family, enrichment);
    await db.runTransaction(async (tx) => {
      const current = await tx.get(familyRef);
      const currentJob = await tx.get(jobRef);
      const data = current.data();
      if (!current.exists || !currentJob.exists || currentJob.data()?.leaseId !== claimed.leaseId
        || data?.version !== claimed.familyVersion || data?.enrichmentJobId !== claimed.jobId) throw new Error("job_lease_lost");
      tx.set(familyRef, { ...update, enrichmentJobId: FieldValue.delete(), enrichmentJobVersion: FieldValue.delete(), enrichmentLeaseExpiresAt: FieldValue.delete() }, { merge: true });
      tx.set(jobRef, { state: "complete", leaseId: FieldValue.delete(), leaseExpiresAt: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    });
    return true;
  } catch (error) {
    const attempt = Number(claimed.attempt ?? 0); const retry = retryState(attempt);
    await releaseClaimedEnrichmentJob(db, claimed, failureMessage(error), retry);
    return false;
  }
}
