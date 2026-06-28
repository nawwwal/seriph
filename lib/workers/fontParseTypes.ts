/** Shared message/result types for the font parser worker and its client hook. */

export interface ParseRequest {
  id: string;
  file: ArrayBuffer;
  filename: string;
}

export interface ParseResult {
  id: string;
  filename?: string;
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
