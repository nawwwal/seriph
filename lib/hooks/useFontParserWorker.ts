/** Hook exposing the font parser worker with lazy initialization. */
import { useCallback } from 'react';
import type { ParseResult } from '../workers/fontParseTypes';
import { type ParseOptions } from '../workers/workerClient';
import { requestParse, requestParseBatch } from '../workers/parseRequests';

export type { ParseOptions };

export function useFontParserWorker() {
  const parseFile = useCallback(
    (file: File, options?: ParseOptions): Promise<ParseResult> => requestParse(file, options),
    []
  );
  const parseBatch = useCallback(
    (files: File[], options?: ParseOptions): Promise<ParseResult[]> => requestParseBatch(files, options),
    []
  );
  return { parseFile, parseBatch };
}
