export type ImportSourceState =
  | "registered" | "uploading" | "uploaded" | "discovering" | "discovered"
  | "failed" | "canceled" | "timed_out";

export type ImportPlanState =
  | "building" | "validated" | "applying" | "applied" | "partial" | "failed";

export type ImportEnrichmentState =
  | "blocked" | "queued" | "rendering" | "submitted" | "analyzing"
  | "embedding" | "indexing" | "complete" | "retrying" | "failed"
  | "skipped_disabled";

export type ImportBatchOutcome =
  | "active" | "succeeded" | "partial" | "needs_review" | "failed" | "canceled";

export interface ImportError {
  code: string;
  message: string;
  phase: "upload" | "discovery" | "planning" | "application" | "enrichment";
  retryable: boolean;
}

export interface ImportPhase<TState extends string> {
  state: TState;
  attempts: number;
  updatedAt: string;
  error?: ImportError;
}

export interface ImportSource {
  sourceId: string;
  ownerId: string;
  batchId: string;
  originalPath: string;
  filename: string;
  declaredSize: number;
  declaredMimeType: string;
  storagePath: string;
  uploadConfirmed: boolean;
  state: ImportSourceState;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  error?: ImportError;
}

export interface ImportBatchCounters {
  sources: number;
  discoveredItems: number;
  fonts: number;
  families: number;
  duplicates: number;
  review: number;
  warnings: number;
  failures: number;
}

export interface BatchTerminalSummary {
  appliedFamilies: number;
  canceled: number;
  duplicates: number;
  failures: number;
  nonterminal: number;
  review: number;
}

export interface ImportBatch {
  batchId: string;
  schemaVersion: number;
  ownerId: string;
  label: string;
  sealed: boolean;
  expectedSourceCount: number;
  planVersion: number;
  phases: {
    upload: ImportPhase<ImportSourceState>;
    planning: ImportPhase<ImportPlanState>;
    enrichment: ImportPhase<ImportEnrichmentState>;
  };
  counters: ImportBatchCounters;
  outcome: ImportBatchOutcome;
  terminalSummary?: BatchTerminalSummary;
  createdAt: string;
  updatedAt: string;
}
