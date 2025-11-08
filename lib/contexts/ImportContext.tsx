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
 * Combined status for an upload/analysis item
 */
export interface CombinedStatus {
  uploadState: UploadState;
  analysisState: AnalysisState;
  displayText: string;
  priority: 'upload' | 'analysis' | 'complete';
}

/**
 * Get combined status display text and priority
 */
export function getCombinedStatus(
  uploadState?: UploadState,
  analysisState?: AnalysisState
): CombinedStatus {
  // Default states
  const upload = uploadState || 'pending';
  const analysis = analysisState || 'not_started';

  // Priority rules: Upload errors take precedence, then analysis errors
  if (upload === 'failed' || upload === 'error') {
    return {
      uploadState: upload,
      analysisState: analysis,
      displayText: `Upload failed${analysis !== 'not_started' ? ` (Analysis: ${analysis})` : ''}`,
      priority: 'upload',
    };
  }

  if (upload === 'canceled') {
    return {
      uploadState: upload,
      analysisState: analysis,
      displayText: 'Canceled',
      priority: 'upload',
    };
  }

  // If upload is complete, show analysis state
  if (upload === 'uploaded' || upload === 'processed_by_api' || upload === 'verifying') {
    if (analysis === 'error' || analysis === 'quarantined') {
      return {
        uploadState: upload,
        analysisState: analysis,
        displayText: `Error (Upload OK, Analysis: ${analysis})`,
        priority: 'analysis',
      };
    }
    if (analysis === 'complete') {
      return {
        uploadState: upload,
        analysisState: analysis,
        displayText: 'Complete',
        priority: 'complete',
      };
    }
    return {
      uploadState: upload,
      analysisState: analysis,
      displayText: `Ready (Analysis: ${analysis})`,
      priority: 'analysis',
    };
  }

  // Upload in progress
  return {
    uploadState: upload,
    analysisState: analysis,
    displayText: `Processing (Upload: ${upload}${analysis !== 'not_started' ? `, Analysis: ${analysis}` : ''})`,
    priority: 'upload',
  };
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

