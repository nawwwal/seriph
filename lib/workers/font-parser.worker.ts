/**
 * Font parser Web Worker. Parses font files client-side (opentype.js) to extract
 * the minimal metadata needed for preview grouping. Logic lives in
 * ./fontParseCore; shared types in ./fontParseTypes (also imported by the hook).
 */
import type { ParseRequest, CompleteMessage, ProgressMessage } from './fontParseTypes';
import { parseFont, processBatch } from './fontParseCore';

self.addEventListener('message', async (event: MessageEvent) => {
  const { type, data } = event.data;

  if (type === 'parse') {
    const request: ParseRequest = data;
    const result = await parseFont(request);
    self.postMessage({ type: 'complete', id: request.id, result } as CompleteMessage);
  } else if (type === 'parseBatch') {
    const requests: ParseRequest[] = data.requests;
    const batchSize = data.batchSize || 3;
    const results = await processBatch(requests, batchSize, (id, progress) => {
      self.postMessage({ type: 'progress', id, progress } as ProgressMessage);
    });
    for (const result of results) {
      self.postMessage({ type: 'complete', id: result.id, result } as CompleteMessage);
    }
  }
});
