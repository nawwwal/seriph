import type { ImportBatchSummary } from '@/lib/imports/mapImportBatch';

export type UploadCenterFilter = 'active' | 'completed' | 'review' | 'failed';

export const toggleUploadFilter = (current: UploadCenterFilter | null, next: UploadCenterFilter) => current === next ? null : next;

export const matchesUploadFilter = (batch: ImportBatchSummary, filter: UploadCenterFilter) =>
  filter === 'active' ? batch.outcome === 'active' :
  filter === 'completed' ? batch.outcome === 'succeeded' :
  filter === 'review' ? batch.outcome === 'needs_review' :
  batch.outcome === 'failed' || batch.outcome === 'partial';
