'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import type { AnalysisState, UploadState } from '@/models/ingest.models';

export type ImportState =
  | { kind: 'idle' }
  | { kind: 'drag-over' }
  | { kind: 'queued'; files: File[] }
  | {
      kind: 'processing';
      progress: number;
      processed: number;
      total: number;
      currentFile?: string;
    }
  | {
      kind: 'summary';
      families: Array<{ name: string; styles: number; classification: string }>;
    }
  | { kind: 'error'; message: string; files?: string[] };

/**
 * A single canonical stage derived from the two independent lanes
 * (upload + analysis). Mutually exclusive — every item is in exactly one.
 */
export type IngestStage =
  | 'queued'
  | 'uploading'
  | 'uploaded'
  | 'analyzing'
  | 'enriching'
  | 'complete'
  | 'error'
  | 'quarantined'
  | 'canceled';

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
  queued: 'Queued',
  uploading: 'Uploading',
  uploaded: 'Uploaded',
  analyzing: 'Analyzing',
  enriching: 'Enriching',
  complete: 'Complete',
  error: 'Error',
  quarantined: 'Quarantined',
  canceled: 'Canceled',
};

/**
 * Canonical status from the two lanes only (the legacy `status` field is no
 * longer consulted for display). `uploadProgress` is the client-driven 0-100
 * resumable progress when uploading.
 */
export function getCombinedStatus(
  uploadState?: UploadState,
  analysisState?: AnalysisState,
  uploadProgress?: number
): CombinedStatus {
  const upload = uploadState || 'pending';
  const analysis = analysisState || 'not_started';

  const uploadDone =
    upload === 'uploaded' || upload === 'processed_by_api' || upload === 'verifying';

  let stage: IngestStage;
  let percent: number;

  if (upload === 'canceled') {
    stage = 'canceled';
    percent = 0;
  } else if (upload === 'failed' || upload === 'error') {
    stage = 'error';
    percent = 0;
  } else if (analysis === 'quarantined') {
    stage = 'quarantined';
    percent = 100;
  } else if (analysis === 'error') {
    stage = 'error';
    percent = 50;
  } else if (analysis === 'complete') {
    stage = 'complete';
    percent = 100;
  } else if (!uploadDone) {
    // Upload lane (first 50%). A client-driven `uploadProgress` in (0,100) means
    // the browser is still streaming bytes even if the doc still says `pending`.
    const clientUploading =
      typeof uploadProgress === 'number' && uploadProgress > 0 && uploadProgress < 100;
    if (upload === 'uploading' || upload === 'resumed' || upload === 'retrying' || clientUploading) {
      stage = 'uploading';
      percent = Math.round(Math.min(Math.max(uploadProgress ?? 0, 0), 100) * 0.5);
    } else if (typeof uploadProgress === 'number' && uploadProgress >= 100) {
      stage = 'uploaded';
      percent = 50;
    } else {
      stage = 'queued';
      percent = 0;
    }
  } else {
    // Analysis lane (second 50%)
    if (analysis === 'analyzing') {
      stage = 'analyzing';
      percent = 65;
    } else if (analysis === 'enriching') {
      stage = 'enriching';
      percent = 85;
    } else {
      stage = 'uploaded';
      percent = 50;
    }
  }

  const priority: CombinedStatus['priority'] =
    stage === 'complete'
      ? 'complete'
      : stage === 'queued' || stage === 'uploading'
        ? 'upload'
        : 'analysis';

  return { uploadState: upload, analysisState: analysis, stage, displayText: STAGE_TEXT[stage], priority, percent };
}

interface ImportContextType {
  state: ImportState;
  setState: (state: ImportState) => void;
}

const ImportContext = createContext<ImportContextType | undefined>(undefined);

export function ImportProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ImportState>({ kind: 'idle' });

  return <ImportContext.Provider value={{ state, setState }}>{children}</ImportContext.Provider>;
}

export function useImport() {
  const context = useContext(ImportContext);
  if (!context) {
    throw new Error('useImport must be used within an ImportProvider');
  }
  return context;
}

