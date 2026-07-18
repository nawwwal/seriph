import type { ImportBatchSummary } from '@/lib/imports/mapImportBatch';

type Data = Record<string, unknown>;
const record = (value: unknown): Data => value && typeof value === 'object' && !Array.isArray(value) ? value as Data : {};
const number = (data: Data, keys: string[]) => keys.map((key) => data[key]).find((value): value is number => typeof value === 'number' && Number.isFinite(value));

export interface BatchProgress { completed: number; total: number; percent: number | null; }

export function phaseProgress(phase: unknown, fallbackTotal: number): BatchProgress {
  const data = record(phase); const total = number(data, ['total', 'expected', 'target']) ?? fallbackTotal;
  const explicit = number(data, ['completed', 'processed', 'done', 'succeeded', 'indexed']);
  const percentValue = number(data, ['progress', 'percent']);
  const completed = explicit ?? (percentValue === undefined ? 0 : Math.round(total * Math.max(0, Math.min(100, percentValue)) / 100));
  const state = typeof data.state === 'string' ? data.state : '';
  const terminal = ['uploaded', 'discovered', 'validated', 'applied', 'complete', 'skipped_disabled'].includes(state);
  return { completed: Math.min(total, Math.max(0, completed)), total, percent: percentValue ?? (terminal ? 100 : total ? Math.round(completed / total * 100) : null) };
}

export function currentPhase(batch: ImportBatchSummary) {
  const names = ['upload', 'planning', 'enrichment'];
  const terminal = ['uploaded', 'discovered', 'validated', 'applied', 'complete', 'skipped_disabled'];
  const name = names.find((key) => !terminal.includes(String(record(batch.phases[key]).state))) ?? 'enrichment';
  const phase = record(batch.phases[name]);
  return { name, state: typeof phase.state === 'string' ? phase.state : 'pending', progress: phaseProgress(phase, batch.counters.families) };
}

const title = (value: string) => value.replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase());

export default function UploadCenterSummary({ batch }: { batch: ImportBatchSummary }) {
  const enrichment = phaseProgress(batch.phases.enrichment, batch.counters.families);
  const cells = [
    `${batch.counters.sources}/${batch.expectedSourceCount} sources uploaded`,
    `${batch.counters.discoveredItems} items discovered`,
    `${batch.counters.families} families catalogued`,
    `AI ${enrichment.completed}/${enrichment.total}`,
    `${batch.counters.review} review`,
  ];
  return <div aria-label="Batch summary" className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
    {cells.map((cell) => <div key={cell} className="rule rounded-[var(--radius)] p-2">{cell}</div>)}
    <span className="sr-only">Outcome: {title(batch.outcome)}</span>
  </div>;
}

