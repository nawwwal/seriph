import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeRemoteConfig } from "../config/remoteConfig";
import { collectPendingEnrichmentJobs, pollEnrichmentBatches } from "../ingest/batchEnrich";
import { watchExpiredEnrichmentLeases } from "../ingest/batch/poll";
import { BATCH_POLL_OPTIONS, ENRICHMENT_COLLECTOR_OPTIONS, ENRICHMENT_LEASE_WATCHDOG_OPTIONS } from "../options";

/**
 * Versioned enrichment (submit). On a schedule, collect queued family jobs,
 * validate them independently, and dispatch accepted jobs to the provider.
 */
export const submitEnrichmentBatch = onSchedule(ENRICHMENT_COLLECTOR_OPTIONS, async () => {
  try {
    await initializeRemoteConfig();
  } catch {
    // defaults
  }
  await collectPendingEnrichmentJobs();
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

/** Reclaim expired provider leases independently of provider-output polling. */
export const watchdogEnrichmentLeases = onSchedule(ENRICHMENT_LEASE_WATCHDOG_OPTIONS, async () => {
  try {
    await initializeRemoteConfig();
  } catch {
    // defaults
  }
  await watchExpiredEnrichmentLeases();
});
