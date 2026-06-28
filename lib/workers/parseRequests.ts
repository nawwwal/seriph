import type { ParseRequest, ParseResult, ProgressMessage, CompleteMessage } from './fontParseTypes';
import { getWorker, readFileBuffer, type ParseOptions } from './workerClient';

/** Parse a single file via the worker, resolving with its result. */
export async function requestParse(file: File, options?: ParseOptions): Promise<ParseResult> {
  const worker = await getWorker();
  const buffer = await readFileBuffer(file);
  const request: ParseRequest = { id: `${file.name}-${Date.now()}`, file: buffer, filename: file.name };

  return new Promise((resolve) => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.id !== request.id) return;
      if (message.type === 'progress') {
        options?.onProgress?.(request.id, (message as ProgressMessage).progress);
      } else if (message.type === 'complete') {
        worker.removeEventListener('message', handleMessage);
        const result = (message as CompleteMessage).result;
        options?.onComplete?.(result);
        resolve(result);
      }
    };
    worker.addEventListener('message', handleMessage);
    worker.postMessage({ type: 'parse', data: request });
  });
}

/** Parse a batch of files via the worker, resolving once all complete. */
export async function requestParseBatch(files: File[], options?: ParseOptions): Promise<ParseResult[]> {
  const worker = await getWorker();
  const buffers = await Promise.all(files.map((file) => readFileBuffer(file)));
  const requests: ParseRequest[] = files.map((file, i) => ({
    id: `${file.name}-${Date.now()}-${Math.random()}`,
    file: buffers[i],
    filename: file.name,
  }));

  return new Promise((resolve) => {
    const results: ParseResult[] = [];
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'progress') {
        options?.onProgress?.(message.id, (message as ProgressMessage).progress);
      } else if (message.type === 'complete') {
        const result = (message as CompleteMessage).result;
        results.push(result);
        options?.onComplete?.(result);
        if (results.length === requests.length) {
          worker.removeEventListener('message', handleMessage);
          resolve(results);
        }
      }
    };
    worker.addEventListener('message', handleMessage);
    worker.postMessage({ type: 'parseBatch', data: { requests, batchSize: 3 } });
  });
}
