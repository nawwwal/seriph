import { act, create } from 'react-test-renderer';
import { createElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { importStatus } from '@/lib/imports/importStatus';
import type { ImportBatchSummary } from '@/lib/imports/mapImportBatch';

const state = vi.hoisted(() => ({ isImportOpen: true, closeImport: vi.fn(), upload: vi.fn() }));
vi.mock('@/lib/contexts/UploadContext', () => ({ useUploads: () => state }));
vi.mock('@/lib/hooks/useDurableBatchUpload', () => ({ useDurableBatchUpload: () => ({ upload: state.upload, isUploading: false }) }));
vi.mock('@/components/ui/Modal', () => ({ default: ({ children }: { children: ReactNode }) => createElement('modal', null, children) }));
vi.mock('@/components/ui/Button', () => ({ Button: ({ children, ...props }: { children?: ReactNode; [key: string]: unknown }) => createElement('button', props, children) }));

import ImportOptionsModal from '@/components/import/ImportOptionsModal';

const batch = (outcome: ImportBatchSummary['outcome'], phases: Record<string, unknown> = {}, counters: Partial<ImportBatchSummary['counters']> = {}): ImportBatchSummary => ({
  batchId: outcome,
  ownerId: 'user-a',
  label: 'Archive',
  expectedSourceCount: 1,
  outcome,
  counters: { sources: 1, discoveredItems: 0, fonts: 0, families: 0, duplicates: 0, review: 0, warnings: 0, failures: 0, ...counters },
  phases,
  createdAt: 1,
  updatedAt: 1,
});

describe('Drive-like import surface', () => {
  it('maps every batch phase to one editorial status label', () => {
    expect(importStatus(batch('active'))).toBe('Uploading');
    expect(importStatus(batch('active', {}, { discoveredItems: 1 }))).toBe('Processing');
    expect(importStatus(batch('active', {}, { discoveredItems: 1 }), true)).toBe('Processing');
    expect(importStatus(batch('active', {}, { discoveredItems: 1, families: 1 }))).toBe('Enriching');
    expect(importStatus(batch('needs_review'))).toBe('Needs attention');
    expect(importStatus(batch('succeeded'))).toBe('Done');
  });

  it('selects a ZIP in the modal and starts the durable upload without navigation', async () => {
    let renderer!: ReturnType<typeof create>;
    await act(async () => { renderer = create(createElement(ImportOptionsModal)); });
    const zip = renderer.root.findAllByType('button').find((node) => node.children[0] === 'Choose ZIP');
    expect(zip).toBeDefined();
    const input = renderer.root.findAllByProps({ accept: '.zip' })[0]!;
    await act(async () => { input.props.onChange({ target: { files: [{ name: 'archive.zip', size: 4, type: 'application/zip' }], value: '' } }); });
    expect(state.closeImport).toHaveBeenCalled();
    expect(state.upload).toHaveBeenCalledWith([{ file: { name: 'archive.zip', size: 4, type: 'application/zip' }, relativePath: 'archive.zip' }]);
  });
});
