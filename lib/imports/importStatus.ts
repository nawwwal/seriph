import type { ImportBatchSummary } from './mapImportBatch';

export const IMPORT_STATUS_LABELS = ['Uploading', 'Processing', 'Enriching', 'Needs attention', 'Done'] as const;
export type ImportStatus = typeof IMPORT_STATUS_LABELS[number];

type Data = Record<string, unknown>;
const record = (value: unknown): Data => value && typeof value === 'object' && !Array.isArray(value) ? value as Data : {};
const number = (data: Data, keys: string[]) => keys.map((key) => data[key]).find((value): value is number => typeof value === 'number' && Number.isFinite(value));
const state = (phase: unknown) => phase && typeof phase === 'object' && typeof (phase as { state?: unknown }).state === 'string'
  ? (phase as { state: string }).state
  : '';

export function phasePercent(phase: unknown, fallbackTotal: number): number | undefined {
  const data = record(phase);
  const explicit = number(data, ['progress', 'percent']);
  if (explicit !== undefined) return Math.max(0, Math.min(100, explicit));
  const total = number(data, ['total', 'expected', 'target']) ?? fallbackTotal;
  const completed = number(data, ['completed', 'processed', 'done', 'succeeded', 'indexed']) ?? 0;
  if (total > 0) return Math.round(Math.min(total, Math.max(0, completed)) / total * 100);
  return ['uploaded', 'discovered', 'validated', 'applied', 'complete', 'skipped_disabled'].includes(String(data.state)) ? 100 : undefined;
}

export function currentImportPercent(batch: ImportBatchSummary): number | undefined {
  const names = ['upload', 'planning', 'enrichment'];
  const terminal = ['uploaded', 'discovered', 'validated', 'applied', 'complete', 'skipped_disabled'];
  const name = names.find((key) => !terminal.includes(state(batch.phases[key]))) ?? 'enrichment';
  return phasePercent(batch.phases[name], batch.counters.families);
}

export function importStatus(batch: ImportBatchSummary, hasClientUpload = false): ImportStatus {
  if (batch.outcome === 'succeeded') return 'Done';
  if (batch.outcome === 'failed' || batch.outcome === 'partial' || batch.outcome === 'needs_review') return 'Needs attention';
  if (hasClientUpload && batch.counters.discoveredItems === 0) return 'Uploading';
  if (batch.counters.families > 0 || ['applied', 'complete', 'completed'].includes(state(batch.phases.planning))) return 'Enriching';
  if (batch.counters.discoveredItems > 0 || state(batch.phases.planning) === 'validated') return 'Processing';
  return 'Uploading';
}
