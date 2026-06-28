import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeRemoteConfig } from "../config/remoteConfig";
import { submitPendingEnrichmentBatch, pollEnrichmentBatches } from "../ingest/batchEnrich";
import { BATCH_SUBMIT_OPTIONS, BATCH_POLL_OPTIONS } from "../options";

/**
 * All-batch enrichment (submit). On a schedule, collect every `ready` family,
 * render specimens, and submit one Gemini Batch API job for the multimodal
 * analysis (50% of realtime price). See ingest/batchEnrich.ts.
 */
export const submitEnrichmentBatch = onSchedule(BATCH_SUBMIT_OPTIONS, async () => {
  try {
    await initializeRemoteConfig();
  } catch {
    // defaults
  }
  await submitPendingEnrichmentBatch();
});

/**
 * All-batch enrichment (poll). On a schedule, check in-flight batch jobs; when a
 * job finishes, parse its output, embed each family inline, write the enrichment
 * + vector, and finalize the originating ingests.
 */
export const pollEnrichmentBatch = onSchedule(BATCH_POLL_OPTIONS, async () => {
  try {
    await initializeRemoteConfig();
  } catch {
    // defaults
  }
  await pollEnrichmentBatches();
});
