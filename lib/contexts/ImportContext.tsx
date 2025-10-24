'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

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

