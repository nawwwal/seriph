import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ImportBatchSummary } from '@/lib/imports/mapImportBatch';
import { matchesUploadFilter } from '@/components/upload/uploadCenterFilters';

const uploadState = vi.hoisted(() => ({
  batches: [] as ImportBatchSummary[],
  close: vi.fn(),
  isOpen: true,
  sourceProgress: {} as Record<string, number>,
}));

vi.mock('@/lib/contexts/UploadContext', () => ({ useUploads: () => uploadState }));
vi.mock('@/lib/contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/components/ui/Modal', () => ({
  default: ({ children }: { children: ReactNode }) => createElement('section', { 'data-test-modal': true }, children),
}));

import UploadCenterModal from '@/components/upload/UploadCenterModal';

const batchFixture: ImportBatchSummary = {
  batchId: 'batch-july',
  ownerId: 'user-a',
  label: 'July archive',
  expectedSourceCount: 3,
  outcome: 'needs_review',
  counters: {
    sources: 3,
    discoveredItems: 8,
    fonts: 8,
    families: 8,
    duplicates: 0,
    review: 2,
    warnings: 0,
    failures: 0,
  },
  phases: {
    upload: { state: 'uploaded', progress: 100 },
    planning: { state: 'applied', progress: 100 },
    enrichment: { state: 'analyzing', completed: 5, total: 8, progress: 62 },
  },
  createdAt: 1_000,
  updatedAt: 2_000,
};

function renderUploadCenter(batches: ImportBatchSummary[], sourceProgress: Record<string, number> = {}) {
  uploadState.batches = batches;
  uploadState.sourceProgress = sourceProgress;
  return renderToStaticMarkup(createElement(UploadCenterModal));
}

describe('batch-first Upload Center', () => {
  it('shows server counters and keeps terminal batches visible', () => {
    const html = renderUploadCenter([batchFixture]);

    expect(html).toContain('3/3 sources uploaded');
    expect(html).toContain('8 families catalogued');
    expect(html).toContain('AI 5/8');
    expect(html).toContain('2 review');
    expect(html).toContain('Needs review');
  });

  it('exposes batch expansion state to assistive technology', () => {
    const html = renderUploadCenter([batchFixture]);

    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="upload-batch-batch-july"');
  });

  it('keeps client upload progress visible as an overlay on server batches', () => {
    expect(renderUploadCenter([batchFixture], { sourceA: 40, sourceB: 60 })).toContain('Client upload overlay: 50%');
  });

  it('maps active, completed, review, and partial failure outcomes to filters', () => {
    expect(matchesUploadFilter({ ...batchFixture, outcome: 'active' }, 'active')).toBe(true);
    expect(matchesUploadFilter({ ...batchFixture, outcome: 'succeeded' }, 'completed')).toBe(true);
    expect(matchesUploadFilter(batchFixture, 'review')).toBe(true);
    expect(matchesUploadFilter({ ...batchFixture, outcome: 'partial' }, 'failed')).toBe(true);
    expect(matchesUploadFilter({ ...batchFixture, outcome: 'canceled' }, 'failed')).toBe(false);
  });

});
