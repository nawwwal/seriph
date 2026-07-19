export type AnalysisState =
  | 'not_started'
  | 'queued'
  | 'analyzing'
  | 'enriching'
  | 'complete'
  | 'error'
  | 'retrying'
  | 'quarantined';

export interface ConflictResolution {
  type: 'keep_alternates' | 'replace_older' | 'merge_stylistic_sets' | 'quarantine';
  resolvedAt?: string;
  resolvedBy?: string;
}
