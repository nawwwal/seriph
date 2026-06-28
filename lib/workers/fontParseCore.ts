import * as opentype from 'opentype.js';
import type { ParseRequest, ParseResult } from './fontParseTypes';
import { computeQuickHash, computeFullHash } from './fontHash';
import { extractNameTable, extractOS2Metrics, detectVariableFont } from './fontExtract';

/** Parse a single font file into minimal grouping metadata. */
export async function parseFont(request: ParseRequest): Promise<ParseResult> {
  const { id, file, filename } = request;
  const result: ParseResult = { id, filename, success: false, errors: [], warnings: [] };

  try {
    const [quickHash, contentHash] = await Promise.all([computeQuickHash(file), computeFullHash(file)]);
    result.quickHash = quickHash;
    result.contentHash = contentHash;

    let font: opentype.Font;
    try {
      font = opentype.parse(file);
    } catch (parseError: any) {
      result.errors?.push(`Failed to parse font: ${parseError.message}`);
      return result;
    }

    const nameData = extractNameTable(font);
    result.provisionalFamily = nameData.family || filename.replace(/\.[^/.]+$/, '');
    result.subfamily = nameData.subfamily || 'Regular';
    result.postScriptName = nameData.postScriptName;
    result.weightClass = extractOS2Metrics(font).weightClass;

    const variableData = detectVariableFont(font);
    result.isVariable = variableData.isVariable;
    result.axes = variableData.axes;

    result.success = true;
  } catch (error: any) {
    result.errors?.push(`Unexpected error: ${error.message}`);
  }
  return result;
}

/** Parse multiple files in small batches, reporting progress per file. */
export async function processBatch(
  requests: ParseRequest[],
  batchSize = 3,
  onProgress?: (id: string, progress: number) => void
): Promise<ParseResult[]> {
  const results: ParseResult[] = [];
  const total = requests.length;
  for (let i = 0; i < requests.length; i += batchSize) {
    const batch = requests.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((request, batchIndex) => {
        onProgress?.(request.id, Math.round(((i + batchIndex) / total) * 100));
        return parseFont(request);
      })
    );
    results.push(...batchResults);
  }
  return results;
}
