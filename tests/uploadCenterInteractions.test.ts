import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ImportBatchSummary } from '@/lib/imports/mapImportBatch';
import type { IngestRecord } from '@/models/ingest.models';

const batch: ImportBatchSummary = { batchId: 'batch-july', ownerId: 'user-a', label: 'July archive', expectedSourceCount: 1, outcome: 'active', counters: { sources: 1, discoveredItems: 1, fonts: 1, families: 1, duplicates: 0, review: 0, warnings: 0, failures: 0 }, phases: { upload: { state: 'uploaded' }, planning: { state: 'applying', progress: 25 }, enrichment: { state: 'blocked' } }, createdAt: 1, updatedAt: 1 };
const legacy: IngestRecord = { id: 'legacy-1', ingestId: 'legacy-1', ownerId: 'user-a', originalName: 'legacy.otf', status: 'processing', uploadState: 'uploading', analysisState: 'analyzing' };
const uploadState = vi.hoisted(() => ({ batches: [] as ImportBatchSummary[], close: vi.fn(), ingests: [] as IngestRecord[], isOpen: true, loadChildren: vi.fn(), open: vi.fn(), setSourceProgress: vi.fn(), setUploadProgress: vi.fn(), sourceProgress: {}, uploadProgress: {} }));
vi.mock('@/lib/contexts/UploadContext', () => ({ useUploads: () => uploadState }));
vi.mock('@/components/ui/Modal', () => ({ default: ({ children }: { children: ReactNode }) => createElement('section', null, children) }));
import UploadCenterModal from '@/components/upload/UploadCenterModal';

describe('Upload Center interactions', () => {
  it('toggles the filter selected by the filter button', async () => {
    const { toggleUploadFilter } = await import('@/components/upload/uploadCenterFilters');
    expect(toggleUploadFilter(null, 'review')).toBe('review');
    expect(toggleUploadFilter('review', 'review')).toBeNull();
  });

  it('calls loadChildren on expansion and formats loaded child counts', async () => {
    const { formatBatchChildren, loadBatchChildren } = await import('@/components/upload/UploadBatchRow');
    const loadChildren = vi.fn(async () => ({ batch, familyPlans: [{ id: 'f1' }], reviewItems: [{ id: 'r1' }, { id: 'r2' }], familyPlansCursor: null, reviewItemsCursor: null }));
    const children = await loadBatchChildren(batch.batchId, loadChildren);
    expect(loadChildren).toHaveBeenCalledWith(batch.batchId);
    expect(formatBatchChildren(children)).toBe('1 family plans · 2 review items');
  });

  it('keeps the legacy ingest fallback and calculates the current phase', async () => {
    const { currentPhase } = await import('@/components/upload/UploadCenterSummary');
    uploadState.batches = [];
    uploadState.ingests = [legacy];
    expect(renderToStaticMarkup(createElement(UploadCenterModal))).toContain('legacy.otf');
    expect(currentPhase(batch)).toMatchObject({ name: 'planning', state: 'applying', progress: { percent: 25 } });
  });
});
