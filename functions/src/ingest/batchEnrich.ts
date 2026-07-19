/**
 * All-batch enrichment lane (barrel).
 *
 * Instead of enriching each family inline the moment it becomes `ready`, we
 * collect every pending family on a schedule and run the multimodal analysis
 * through the Gemini Batch API (50% of realtime price, <=24h SLA). The font
 * stays instantly viewable; only moods/summary/search vector arrive on the
 * batch cadence. Implementation: ./batch/{client,submit,output,poll}.
 */
export { submitPendingEnrichmentBatch } from "./batch/submit";
export { pollEnrichmentBatches } from "./batch/poll";
export { collectPendingEnrichmentJobs } from "../enrichment/jobs/production";
