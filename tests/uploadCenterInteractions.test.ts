import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ImportBatchChildren, ImportBatchSummary } from '@/lib/imports/mapImportBatch';
import type { IngestRecord } from '@/models/ingest.models';

const state = vi.hoisted(() => ({ batches: [] as ImportBatchSummary[], close: vi.fn(), ingests: [] as IngestRecord[], isOpen: true, loadChildren: vi.fn(), open: vi.fn(), sourceProgress: {}, uploadProgress: {} }));
vi.mock('@/lib/contexts/UploadContext', () => ({ useUploads: () => state }));
vi.mock('@/components/ui/Modal', () => ({ default: ({ children }: { children: ReactNode }) => createElement('section', null, children) }));
vi.mock('@/components/ui/Button', () => ({ Button: ({ children, size: _size, tone: _tone, icon: _icon, iconPosition: _position, ...props }: { children?: ReactNode; size?: string; tone?: string; icon?: ReactNode; iconPosition?: string; [key: string]: unknown }) => createElement('button', props, children) }));
import UploadCenterModal from '@/components/upload/UploadCenterModal';

const makeBatch = (label: string, outcome: ImportBatchSummary['outcome']): ImportBatchSummary => ({ batchId: label.toLowerCase().replaceAll(' ', '-'), ownerId: 'user-a', label, expectedSourceCount: 1, outcome, counters: { sources: 1, discoveredItems: 1, fonts: 1, families: 1, duplicates: 0, review: outcome === 'needs_review' ? 1 : 0, warnings: 0, failures: 0 }, phases: { upload: { state: 'uploaded' }, planning: { state: 'applying', progress: 25 } }, createdAt: 1, updatedAt: 1 });
const legacy: IngestRecord = { id: 'legacy-1', ingestId: 'legacy-1', ownerId: 'user-a', originalName: 'legacy.otf', status: 'processing', uploadState: 'uploading', analysisState: 'analyzing' };

const visibleLabels = (renderer: ReactTestRenderer) => renderer.root.findAllByType('h3').map((node) => String(node.children[0]));
const children = (): ImportBatchChildren => ({ batch: makeBatch('July archive', 'active'), familyPlans: [{ id: 'f1' }], reviewItems: [{ id: 'r1' }, { id: 'r2' }], familyPlansCursor: null, reviewItemsCursor: null });

describe('Upload Center rendered interactions', () => {
  it('clicking a filter control changes the displayed batch rows', async () => {
    state.batches = [makeBatch('Active archive', 'active'), makeBatch('Review archive', 'needs_review')]; state.ingests = [];
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(createElement(UploadCenterModal)); });
    expect(visibleLabels(renderer)).toEqual(['Active archive', 'Review archive']);
    const review = renderer.root.findAllByType('button').find((node) => node.children[0] === 'Review');
    await act(async () => { review!.props.onClick(); });
    expect(visibleLabels(renderer)).toEqual(['Review archive']);
  });

  it('clicking the actual expansion button loads and renders deferred children', async () => {
    const loadChildren = vi.fn(async () => children()); state.batches = [makeBatch('July archive', 'active')]; state.ingests = []; state.loadChildren = loadChildren;
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(createElement(UploadCenterModal)); });
    let expand = renderer.root.findByProps({ 'aria-controls': 'upload-batch-july-archive' });
    expect(expand.props['aria-expanded']).toBe(false);
    await act(async () => { expand.props.onClick(); });
    expand = renderer.root.findByProps({ 'aria-controls': 'upload-batch-july-archive' });
    expect(expand.props['aria-expanded']).toBe(true);
    expect(loadChildren).toHaveBeenCalledWith('july-archive');
    expect(JSON.stringify(renderer.toJSON())).toContain('1 family plans · 2 review items');
  });

  it('keeps the legacy fallback and calculates the current phase', async () => {
    const { currentPhase } = await import('@/components/upload/UploadCenterSummary');
    state.batches = []; state.ingests = [legacy];
    expect(renderToStaticMarkup(createElement(UploadCenterModal))).toContain('legacy.otf');
    expect(currentPhase(makeBatch('July archive', 'active'))).toMatchObject({ name: 'planning', state: 'applying', progress: { percent: 25 } });
  });
});
