/**
 * Hook for managing font parser Web Worker with lazy initialization
 */

import { useRef, useCallback } from 'react';
import type { ParseRequest, ParseResult, ProgressMessage, CompleteMessage } from '../workers/font-parser.worker';

export interface ParseOptions {
  onProgress?: (id: string, progress: number) => void;
  onComplete?: (result: ParseResult) => void;
}

let workerInstance: Worker | null = null;
let workerInitializing = false;

/**
 * Get or create the font parser worker instance
 */
function getWorker(): Worker | null {
  if (workerInstance) {
    return workerInstance;
  }

  if (workerInitializing) {
    return null;
  }

  try {
    workerInitializing = true;
    // Dynamic module worker import
    workerInstance = new Worker(
      new URL('../workers/font-parser.worker.ts', import.meta.url),
      { type: 'module' }
    );
    workerInitializing = false;
    return workerInstance;
  } catch (error) {
    console.error('Failed to create font parser worker:', error);
    workerInitializing = false;
    return null;
  }
}

/**
 * Hook for using the font parser worker
 */
export function useFontParserWorker() {
  const workerRef = useRef<Worker | null>(null);

  const parseFile = useCallback(
    async (file: File, options?: ParseOptions): Promise<ParseResult> => {
      return new Promise((resolve, reject) => {
        const worker = getWorker();
        if (!worker) {
          reject(new Error('Worker not available'));
          return;
        }

        workerRef.current = worker;

        // Read file as ArrayBuffer
        const reader = new FileReader();
        reader.onload = async (e) => {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          if (!arrayBuffer) {
            reject(new Error('Failed to read file'));
            return;
          }

          const request: ParseRequest = {
            id: `${file.name}-${Date.now()}`,
            file: arrayBuffer,
            filename: file.name,
          };

          // Set up message handler
          const handleMessage = (event: MessageEvent) => {
            const message = event.data;

            if (message.type === 'progress' && message.id === request.id) {
              const progressMsg = message as ProgressMessage;
              options?.onProgress?.(request.id, progressMsg.progress);
            } else if (message.type === 'complete' && message.id === request.id) {
              const completeMsg = message as CompleteMessage;
              worker.removeEventListener('message', handleMessage);
              options?.onComplete?.(completeMsg.result);
              resolve(completeMsg.result);
            }
          };

          worker.addEventListener('message', handleMessage);

          // Send parse request
          worker.postMessage({
            type: 'parse',
            data: request,
          });
        };

        reader.onerror = () => {
          reject(new Error('Failed to read file'));
        };

        reader.readAsArrayBuffer(file);
      });
    },
    []
  );

  const parseBatch = useCallback(
    async (files: File[], options?: ParseOptions): Promise<ParseResult[]> => {
      return new Promise((resolve, reject) => {
        const worker = getWorker();
        if (!worker) {
          reject(new Error('Worker not available'));
          return;
        }

        workerRef.current = worker;

        // Read all files as ArrayBuffers
        const filePromises = files.map((file) => {
          return new Promise<{ file: File; buffer: ArrayBuffer }>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const arrayBuffer = e.target?.result as ArrayBuffer;
              if (!arrayBuffer) {
                reject(new Error(`Failed to read ${file.name}`));
                return;
              }
              resolve({ file, buffer: arrayBuffer });
            };
            reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
            reader.readAsArrayBuffer(file);
          });
        });

        Promise.all(filePromises)
          .then((fileData) => {
            const requests: ParseRequest[] = fileData.map(({ file, buffer }) => ({
              id: `${file.name}-${Date.now()}-${Math.random()}`,
              file: buffer,
              filename: file.name,
            }));

            const results: ParseResult[] = [];
            let completedCount = 0;

            // Set up message handler
            const handleMessage = (event: MessageEvent) => {
              const message = event.data;

              if (message.type === 'progress') {
                const progressMsg = message as ProgressMessage;
                options?.onProgress?.(progressMsg.id, progressMsg.progress);
              } else if (message.type === 'complete') {
                const completeMsg = message as CompleteMessage;
                results.push(completeMsg.result);
                options?.onComplete?.(completeMsg.result);
                completedCount++;

                if (completedCount === requests.length) {
                  worker.removeEventListener('message', handleMessage);
                  resolve(results);
                }
              }
            };

            worker.addEventListener('message', handleMessage);

            // Send batch parse request
            worker.postMessage({
              type: 'parseBatch',
              data: {
                requests,
                batchSize: 3,
              },
            });
          })
          .catch(reject);
      });
    },
    []
  );

  return {
    parseFile,
    parseBatch,
  };
}

