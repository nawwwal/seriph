/**
 * Font Parser Web Worker
 * 
 * Parses font files client-side for preview grouping.
 * Uses opentype.js to extract minimal metadata needed for grouping.
 */

import * as opentype from 'opentype.js';

export interface ParseRequest {
  id: string;
  file: ArrayBuffer;
  filename: string;
}

export interface ParseResult {
  id: string;
  success: boolean;
  provisionalFamily?: string;
  subfamily?: string;
  postScriptName?: string;
  weightClass?: number;
  isVariable?: boolean;
  axes?: Array<{ tag: string; min: number; max: number; default: number }>;
  quickHash?: string;
  contentHash?: string;
  errors?: string[];
  warnings?: string[];
}

export interface ProgressMessage {
  type: 'progress';
  id: string;
  progress: number;
}

export interface CompleteMessage {
  type: 'complete';
  id: string;
  result: ParseResult;
}

export type WorkerMessage = ProgressMessage | CompleteMessage;

/**
 * Compute quick hash: first 1-2 MB + file length
 */
async function computeQuickHash(buffer: ArrayBuffer): Promise<string> {
  const chunkSize = Math.min(2 * 1024 * 1024, buffer.byteLength); // 2 MB or full file
  const chunk = buffer.slice(0, chunkSize);
  const hashBuffer = await crypto.subtle.digest('SHA-256', chunk);
  
  // Include file length in hash
  const lengthBuffer = new ArrayBuffer(8);
  const lengthView = new DataView(lengthBuffer);
  lengthView.setBigUint64(0, BigInt(buffer.byteLength), true);
  
  const combinedBuffer = new Uint8Array(hashBuffer.byteLength + lengthBuffer.byteLength);
  combinedBuffer.set(new Uint8Array(hashBuffer), 0);
  combinedBuffer.set(new Uint8Array(lengthBuffer), hashBuffer.byteLength);
  
  const finalHash = await crypto.subtle.digest('SHA-256', combinedBuffer);
  const hashArray = Array.from(new Uint8Array(finalHash));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compute full SHA-256 hash of entire file
 */
async function computeFullHash(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Extract name table entries
 */
function extractNameTable(font: opentype.Font): {
  family?: string;
  subfamily?: string;
  postScriptName?: string;
} {
  const names = font.names;
  const result: {
    family?: string;
    subfamily?: string;
    postScriptName?: string;
  } = {};

  // Prefer nameID 16 (Typographic Family) over 1 (Family)
  // Fall back to 1 if 16 missing
  result.family = names.preferredFamily || names.fontFamily || names.fontSubfamily;
  result.subfamily = names.preferredSubfamily || names.fontSubfamily;
  result.postScriptName = names.postScriptName;

  return result;
}

/**
 * Extract OS/2 table metrics
 */
function extractOS2Metrics(font: opentype.Font): { weightClass?: number } {
  const os2 = (font as any).tables?.os2;
  if (!os2) return {};

  return {
    weightClass: os2.usWeightClass,
  };
}

/**
 * Detect variable font and extract axes
 */
function detectVariableFont(font: opentype.Font): {
  isVariable: boolean;
  axes?: Array<{ tag: string; min: number; max: number; default: number }>;
} {
  const fvar = (font as any).tables?.fvar;
  if (!fvar || !fvar.axes) {
    return { isVariable: false };
  }

  const axes = fvar.axes.map((axis: any) => ({
    tag: axis.tag,
    min: axis.min,
    max: axis.max,
    default: axis.default,
  }));

  return {
    isVariable: true,
    axes,
  };
}

/**
 * Parse a single font file
 */
async function parseFont(request: ParseRequest): Promise<ParseResult> {
  const { id, file, filename } = request;
  const result: ParseResult = {
    id,
    success: false,
    errors: [],
    warnings: [],
  };

  try {
    // Compute hashes in parallel
    const [quickHash, contentHash] = await Promise.all([
      computeQuickHash(file),
      computeFullHash(file),
    ]);

    result.quickHash = quickHash;
    result.contentHash = contentHash;

    // Parse font with opentype.js
    let font: opentype.Font;
    try {
      font = opentype.parse(file.buffer);
    } catch (parseError: any) {
      result.errors?.push(`Failed to parse font: ${parseError.message}`);
      result.success = false;
      return result;
    }

    // Extract name table
    const nameData = extractNameTable(font);
    result.provisionalFamily = nameData.family || filename.replace(/\.[^/.]+$/, '');
    result.subfamily = nameData.subfamily || 'Regular';
    result.postScriptName = nameData.postScriptName;

    // Extract OS/2 metrics
    const os2Data = extractOS2Metrics(font);
    result.weightClass = os2Data.weightClass;

    // Detect variable font
    const variableData = detectVariableFont(font);
    result.isVariable = variableData.isVariable;
    result.axes = variableData.axes;

    result.success = true;
  } catch (error: any) {
    result.errors?.push(`Unexpected error: ${error.message}`);
    result.success = false;
  }

  return result;
}

/**
 * Process multiple files with batching and progress updates
 */
async function processBatch(
  requests: ParseRequest[],
  batchSize: number = 3,
  onProgress?: (id: string, progress: number) => void
): Promise<ParseResult[]> {
  const results: ParseResult[] = [];
  const total = requests.length;

  for (let i = 0; i < requests.length; i += batchSize) {
    const batch = requests.slice(i, i + batchSize);
    const batchPromises = batch.map(async (request, batchIndex) => {
      const globalIndex = i + batchIndex;
      const progress = Math.round((globalIndex / total) * 100);
      
      if (onProgress) {
        onProgress(request.id, progress);
      }

      return parseFont(request);
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}

// Worker message handler
self.addEventListener('message', async (event: MessageEvent) => {
  const { type, data } = event.data;

  if (type === 'parse') {
    // Single file parse
    const request: ParseRequest = data;
    const result = await parseFont(request);
    
    self.postMessage({
      type: 'complete',
      id: request.id,
      result,
    } as CompleteMessage);
  } else if (type === 'parseBatch') {
    // Batch parse with progress
    const requests: ParseRequest[] = data.requests;
    const batchSize = data.batchSize || 3;

    const results = await processBatch(requests, batchSize, (id, progress) => {
      self.postMessage({
        type: 'progress',
        id,
        progress,
      } as ProgressMessage);
    });

    // Send all results
    for (const result of results) {
      self.postMessage({
        type: 'complete',
        id: result.id,
        result,
      } as CompleteMessage);
    }
  }
});

