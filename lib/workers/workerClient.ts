import type { ParseRequest, ParseResult, ProgressMessage, CompleteMessage } from './fontParseTypes';

export interface ParseOptions {
  onProgress?: (id: string, progress: number) => void;
  onComplete?: (result: ParseResult) => void;
}

let workerInstance: Worker | null = null;
let workerInitPromise: Promise<Worker> | null = null;

/** Lazily create (and memoize) the font parser worker. */
export async function getWorker(): Promise<Worker> {
  if (workerInstance) return workerInstance;
  if (!workerInitPromise) {
    workerInitPromise = new Promise<Worker>((resolve, reject) => {
      try {
        const worker = new Worker(new URL('./font-parser.worker.ts', import.meta.url), { type: 'module' });
        worker.addEventListener('error', (event) => {
          console.error('Font parser worker error:', event);
          workerInstance = null;
          workerInitPromise = null;
        });
        workerInstance = worker;
        resolve(worker);
      } catch (error) {
        console.error('Failed to create font parser worker:', error);
        workerInstance = null;
        workerInitPromise = null;
        reject(error);
      }
    }).catch((error) => {
      workerInitPromise = null;
      throw error;
    });
  }
  return workerInitPromise;
}

export function readFileBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const buf = e.target?.result as ArrayBuffer;
      buf ? resolve(buf) : reject(new Error(`Failed to read ${file.name}`));
    };
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsArrayBuffer(file);
  });
}

export type { ParseRequest, ParseResult, ProgressMessage, CompleteMessage };
