import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { buildPrompt, buildEnrichmentUpdate, parseAnalysis, renderFamilySpecimen } from "../../ai/enrichFont";
import type { FontFamilyDoc } from "../../models/catalog.models";
import { catalogFamilyDocId } from "../../storage/catalogIdentity";
import { FAMILIES_COLLECTION } from "../../storage/familyStore";
import { analysisModelId, batchClient, batchGenerationConfig, SAFETY_SETTINGS } from "../../ingest/batch/client";
import { enrichmentJobRef } from "../jobs/jobStore";
import type { EnrichmentJob } from "../jobs/jobTypes";
import { retryState } from "../jobs/retryPolicy";

const failureMessage = (error: unknown) => error instanceof Error ? error.message : "realtime_enrichment_failed";

export async function processRealtimeEnrichmentJob(db: Firestore, job: EnrichmentJob): Promise<boolean> {
  const familyRef = db.collection(FAMILIES_COLLECTION).doc(catalogFamilyDocId(job.ownerId, job.familyId));
  const jobRef = enrichmentJobRef(db, job.jobId);
  const familySnap = await familyRef.get();
  if (!familySnap.exists) {
    await jobRef.set({ state: "failed", failureCode: "family_missing", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return false;
  }
  const family = { ...familySnap.data(), id: familySnap.id } as FontFamilyDoc;
  if (family.version !== job.familyVersion || family.hidden || family.status === "merged") {
    await jobRef.set({ state: "failed", failureCode: "family_stale", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return false;
  }
  await Promise.all([
    familyRef.set({ status: "enriching", enrichmentJobId: job.jobId, enrichmentJobVersion: job.familyVersion, updatedAt: FieldValue.serverTimestamp() }, { merge: true }),
    jobRef.set({ state: "analyzing", updatedAt: FieldValue.serverTimestamp() }, { merge: true }),
  ]);
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
      const data = current.data();
      if (!current.exists || data?.version !== job.familyVersion || data?.enrichmentJobId !== job.jobId) throw new Error("family_stale");
      tx.set(familyRef, { ...update, enrichmentJobId: FieldValue.delete(), enrichmentJobVersion: FieldValue.delete(), enrichmentLeaseExpiresAt: FieldValue.delete() }, { merge: true });
      tx.set(jobRef, { state: "complete", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    });
    return true;
  } catch (error) {
    const attempt = Number(job.attempt ?? 0); const retry = retryState(attempt);
    await Promise.all([
      familyRef.set({ status: "ready", enrichmentJobId: FieldValue.delete(), enrichmentJobVersion: FieldValue.delete(), enrichmentLeaseExpiresAt: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }, { merge: true }),
      jobRef.set({ state: retry.state, attempt: retry.attempt, failureCode: failureMessage(error), ...(retry.delayMs === null ? { failedAt: FieldValue.serverTimestamp() } : { retryAt: new Date(Date.now() + retry.delayMs) }), updatedAt: FieldValue.serverTimestamp() }, { merge: true }),
    ]);
    return false;
  }
}
