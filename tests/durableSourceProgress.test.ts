import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ImportBatchSummary } from '@/lib/imports/mapImportBatch';
import type { DurableUploadDeps, DurableUploadSource } from '@/models/import-batch.models';
import type { IngestRecord } from '@/models/ingest.models';

const uploadState = vi.hoisted(() => ({
  batches: [] as ImportBatchSummary[],
  close: vi.fn(),
  ingests: [] as IngestRecord[],
  isOpen: true,
  loadChildren: vi.fn(),
  open: vi.fn(),
  setSourceProgress: vi.fn(),
  setUploadProgress: vi.fn(),
  sourceProgress: {} as Record<string, number>,
  uploadProgress: {},
}));

vi.mock('@/lib/contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/lib/contexts/UploadContext', () => ({ useUploads: () => uploadState }));
vi.mock('@/components/ui/Modal', () => ({ default: ({ children }: { children: ReactNode }) => createElement('section', null, children) }));

import UploadCenterModal from '@/components/upload/UploadCenterModal';
import { createSourceProgressBridge } from '@/lib/hooks/durableSourceProgress';
import { runDurableUpload } from '@/lib/hooks/useDurableBatchUpload';

const source = (): DurableUploadSource => ({ sourceId: 'source-1', file: { name: 'one.otf', size: 1, type: 'font/otf' } as File, relativePath: 'one.otf' });
const batch: ImportBatchSummary = { batchId: 'batch-1', ownerId: 'user-a', label: 'Browser import', expectedSourceCount: 1, outcome: 'active', counters: { sources: 1, discoveredItems: 0, fonts: 0, families: 0, duplicates: 0, review: 0, warnings: 0, failures: 0 }, phases: { upload: { state: 'uploading', progress: 42 } }, createdAt: 1, updatedAt: 1 };

const uploadDeps = (progress: DurableUploadDeps['progress'], clearProgress: DurableUploadDeps['clearProgress'], failUpload = false): DurableUploadDeps => ({
  create: async () => ({ batchId: 'batch-1' }),
  register: async (_batchId, rows) => rows.map((row) => ({ ...row, accepted: true, storagePath: 'intake/one.otf' })),
  seal: async () => undefined,
  resume: async (_session, rows) => rows.map((row) => ({ ...row, accepted: true, storagePath: 'intake/one.otf' })),
  upload: async (_source, _file, report) => { if (failUpload) throw new Error('offline'); report(42); },
  fail: async () => undefined,
  progress,
  clearProgress,
});

describe('durable source progress integration', () => {
  it('renders the live Upload Center overlay from the durable uploader context producer and clears it terminally', async () => {
    uploadState.batches = [batch];
    let rendered = '';
    uploadState.setSourceProgress = vi.fn((sourceId: string, percent: number | null) => {
      const next = { ...uploadState.sourceProgress };
      if (percent === null) delete next[sourceId]; else next[sourceId] = percent;
      uploadState.sourceProgress = next;
      if (percent === 42) rendered = renderToStaticMarkup(createElement(UploadCenterModal));
    });
    const progress = createSourceProgressBridge(uploadState.setSourceProgress, () => undefined);
    await runDurableUpload([source()], uploadDeps(progress, (sourceId) => uploadState.setSourceProgress(sourceId, null)));
    expect(rendered).toContain('Client upload overlay: 42%');
    expect(uploadState.sourceProgress).toEqual({});
  });

  it('clears a source overlay after a durable upload failure', async () => {
    const clearProgress = vi.fn();
    await runDurableUpload([source()], uploadDeps(undefined, clearProgress, true));
    expect(clearProgress).toHaveBeenCalledWith('source-1');
  });
});
