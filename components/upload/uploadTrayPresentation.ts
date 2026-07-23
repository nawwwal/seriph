import type { UploadSourcePreview } from '@/lib/contexts/UploadContext';
import type { ImportBatchChild, ImportBatchSummary } from '@/lib/imports/mapImportBatch';
import type { ImportStatus } from '@/lib/imports/importStatus';
import { redactImportDisplayText } from '@/lib/imports/importBatchActions';

type Data = Record<string, unknown>;
const data = (value: unknown): Data => value && typeof value === 'object' && !Array.isArray(value) ? value as Data : {};
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : 0;
const text = (value: unknown) => typeof value === 'string' && value.trim() ? redactImportDisplayText(value) : '';
const familyName = (family: ImportBatchChild) => text(family.familyName ?? family.intendedFamily ?? family.name);
const styleCount = (family: ImportBatchChild) => number(family.styleCount) || number(family.faceCount) || (Array.isArray(family.faces) ? family.faces.length : 0);
const sourceTitle = (sources: UploadSourcePreview[]) => {
  const names = sources.map((source) => text(source.name)).filter(Boolean);
  if (names.length === 0) return '';
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return names.join(' + ');
  return `${names[0]} + ${names.length - 1} more`;
};
const canonicalTitle = (families: ImportBatchChild[]) => {
  const names = [...new Set(families.map(familyName).filter(Boolean))];
  if (names.length === 0) return '';
  if (names.length <= 2) return names.join(' + ');
  return `${names[0]} + ${names.length - 1} families`;
};

export interface UploadTrayPresentation {
  title: string;
  detail: string;
  familyCount: number;
  styleCount: number;
  progress?: number;
}

export function uploadTrayPresentation(input: {
  batch?: ImportBatchSummary;
  families: ImportBatchChild[];
  sources: UploadSourcePreview[];
  status: ImportStatus | null;
  progress?: number;
  notice?: string | null;
}): UploadTrayPresentation {
  const { batch, families, sources, status, progress, notice } = input;
  const familyCount = families.length || batch?.counters.families || 0;
  const styles = families.reduce((sum, family) => sum + styleCount(family), 0) || batch?.counters.fonts || 0;
  const title = canonicalTitle(families) || sourceTitle(sources) || (batch ? 'Importing fonts' : 'Preparing import');
  const counts = familyCount ? `${familyCount} ${familyCount === 1 ? 'family' : 'families'}${styles ? ` · ${styles} ${styles === 1 ? 'style' : 'styles'}` : ''}` : '';
  const phase = data(batch?.phases.enrichment).state;
  let detail = status ?? '';
  if (status === 'Uploading') detail = `Uploading ${sources.length || batch?.expectedSourceCount || 1} ${(sources.length || batch?.expectedSourceCount) === 1 ? 'file' : 'files'}`;
  if (status === 'Processing') detail = batch?.counters.fonts ? `Reading metadata · ${batch.counters.fonts} fonts found` : 'Reading font metadata';
  if (status === 'Enriching') detail = `${counts || 'Building catalogue'} · ${phase === 'complete' ? 'AI complete' : 'AI enrichment'}`;
  if (status === 'Done') detail = counts ? `Added ${counts}` : 'Import complete';
  if (status === 'Needs attention') detail = notice ? text(notice) : counts ? `${counts} · Needs attention` : 'Import needs attention';
  return { title, detail, familyCount, styleCount: styles, ...(progress === undefined ? {} : { progress }) };
}
