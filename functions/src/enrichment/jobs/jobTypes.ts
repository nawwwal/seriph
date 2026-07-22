import { createHash } from "crypto";

export interface EnrichmentJobKey {
  familyId: string;
  familyVersion: number;
  promptVersion: string;
  analysisModel: string;
  embeddingVersion: string;
}

export type EnrichmentJobState =
  | "blocked" | "queued" | "rendering" | "submitting" | "submitted" | "analyzing"
  | "embedding" | "indexing" | "complete" | "retrying" | "failed" | "skipped_disabled";

export interface EnrichmentJob extends EnrichmentJobKey {
  jobId: string;
  ownerId: string;
  batchId: string;
  planVersion: number;
  state: EnrichmentJobState;
  failureCode?: string;
  failureReasons?: string[];
  attempt?: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  submittedAt?: Date | string;
}

/** Stable identity for one family version under one complete enrichment configuration. */
export function enrichmentJobId(input: EnrichmentJobKey): string {
  const identity = [
    input.familyId,
    input.familyVersion,
    input.promptVersion,
    input.analysisModel,
    input.embeddingVersion,
  ].map((value) => String(value).length + ":" + String(value)).join("|");
  return `enrichment-${createHash("sha256").update(identity).digest("hex")}`;
}
