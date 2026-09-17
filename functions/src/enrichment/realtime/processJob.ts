import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { enrichmentUpdateForRealtime } from "./analyzeFamily";
import { suggestFamilyMerges } from "../../ai/jev/merge/suggest";
import type { FontFamilyDoc } from "../../models/catalog.models";
import { catalogFamilyDocId } from "../../storage/catalogIdentity";
import { FAMILIES_COLLECTION } from "../../storage/familyStore";
import { claimEnrichmentJob, enrichmentJobRef, releaseClaimedEnrichmentJob, updateClaimedEnrichmentJob } from "../jobs/jobStore";
import type { EnrichmentJob } from "../jobs/jobTypes";
import { retryState } from "../jobs/retryPolicy";

const failureMessage = (error: unknown) => error instanceof Error ? error.message : "realtime_enrichment_failed";

export async function processRealtimeEnrichmentJob(db: Firestore, job: EnrichmentJob): Promise<boolean> {
  const claimed = await claimEnrichmentJob(db, job.jobId);
  if (!claimed) return false;
  const familyRef = db.collection(FAMILIES_COLLECTION).doc(catalogFamilyDocId(claimed.ownerId, claimed.familyId));
  const jobRef = enrichmentJobRef(db, claimed.jobId);
  const familySnap = await familyRef.get();
  if (!familySnap.exists) {
    await releaseClaimedEnrichmentJob(db, claimed, "family_missing", { state: "failed", attempt: Number(claimed.attempt ?? 0), delayMs: null });
    return false;
  }
  const family = { ...familySnap.data(), id: familySnap.id } as FontFamilyDoc;
  if (Number(family.version ?? 0) !== Number(claimed.familyVersion ?? 0) || family.hidden || family.status === "merged") {
    await releaseClaimedEnrichmentJob(db, claimed, "family_stale", { state: "failed", attempt: Number(claimed.attempt ?? 0), delayMs: null });
    return false;
  }
  if (!(await updateClaimedEnrichmentJob(db, claimed, "analyzing"))) return false;
  try {
    const update = await enrichmentUpdateForRealtime(db, family);
    await db.runTransaction(async (tx) => {
      const current = await tx.get(familyRef);
      const currentJob = await tx.get(jobRef);
      const data = current.data();
      if (!current.exists || !currentJob.exists || currentJob.data()?.leaseId !== claimed.leaseId
        || Number(data?.version ?? 0) !== Number(claimed.familyVersion ?? 0) || data?.enrichmentJobId !== claimed.jobId) throw new Error("job_lease_lost");
      tx.set(familyRef, { ...update, enrichmentJobId: FieldValue.delete(), enrichmentJobVersion: FieldValue.delete(), enrichmentLeaseExpiresAt: FieldValue.delete() }, { merge: true });
      tx.set(jobRef, { state: "complete", leaseId: FieldValue.delete(), leaseExpiresAt: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    });
    await suggestFamilyMerges(db, { ...family, enrichment: (update.enrichment as FontFamilyDoc["enrichment"]) ?? family.enrichment, status: "enriched" });
    return true;
  } catch (error) {
    const attempt = Number(claimed.attempt ?? 0); const retry = retryState(attempt);
    await releaseClaimedEnrichmentJob(db, claimed, failureMessage(error), retry);
    return false;
  }
}
