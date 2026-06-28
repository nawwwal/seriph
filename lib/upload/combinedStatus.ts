import type { AnalysisState, UploadState } from '@/models/ingest.models';

/** A single canonical stage derived from the two independent lanes
 *  (upload + analysis). Mutually exclusive — every item is in exactly one. */
export type IngestStage =
  | 'queued' | 'uploading' | 'uploaded' | 'analyzing' | 'enriching'
  | 'complete' | 'error' | 'quarantined' | 'canceled';

export interface CombinedStatus {
  uploadState: UploadState;
  analysisState: AnalysisState;
  stage: IngestStage;
  displayText: string;
  priority: 'upload' | 'analysis' | 'complete';
  /** Overall 0-100 across both lanes (upload = first half, analysis = second). */
  percent: number;
}

const STAGE_TEXT: Record<IngestStage, string> = {
  queued: 'Queued', uploading: 'Uploading', uploaded: 'Uploaded', analyzing: 'Analyzing',
  enriching: 'Enriching', complete: 'Complete', error: 'Error', quarantined: 'Quarantined', canceled: 'Canceled',
};

/** Canonical status from the two lanes only (legacy `status` is not consulted).
 *  `uploadProgress` is the client-driven 0-100 resumable progress when uploading. */
export function getCombinedStatus(
  uploadState?: UploadState,
  analysisState?: AnalysisState,
  uploadProgress?: number
): CombinedStatus {
  const upload = uploadState || 'pending';
  const analysis = analysisState || 'not_started';
  const uploadDone = upload === 'uploaded' || upload === 'processed_by_api' || upload === 'verifying';

  let stage: IngestStage;
  let percent: number;

  if (upload === 'canceled') {
    stage = 'canceled'; percent = 0;
  } else if (upload === 'failed' || upload === 'error') {
    stage = 'error'; percent = 0;
  } else if (analysis === 'quarantined') {
    stage = 'quarantined'; percent = 100;
  } else if (analysis === 'error') {
    stage = 'error'; percent = 50;
  } else if (analysis === 'complete') {
    stage = 'complete'; percent = 100;
  } else if (!uploadDone) {
    const clientUploading = typeof uploadProgress === 'number' && uploadProgress > 0 && uploadProgress < 100;
    if (upload === 'uploading' || upload === 'resumed' || upload === 'retrying' || clientUploading) {
      stage = 'uploading';
      percent = Math.round(Math.min(Math.max(uploadProgress ?? 0, 0), 100) * 0.5);
    } else if (typeof uploadProgress === 'number' && uploadProgress >= 100) {
      stage = 'uploaded'; percent = 50;
    } else {
      stage = 'queued'; percent = 0;
    }
  } else if (analysis === 'analyzing') {
    stage = 'analyzing'; percent = 65;
  } else if (analysis === 'enriching') {
    stage = 'enriching'; percent = 85;
  } else {
    stage = 'uploaded'; percent = 50;
  }

  const priority: CombinedStatus['priority'] =
    stage === 'complete' ? 'complete' : stage === 'queued' || stage === 'uploading' ? 'upload' : 'analysis';

  return { uploadState: upload, analysisState: analysis, stage, displayText: STAGE_TEXT[stage], priority, percent };
}
