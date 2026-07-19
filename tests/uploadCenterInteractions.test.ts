import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ImportBatchChildren, ImportBatchSummary } from '@/lib/imports/mapImportBatch';
import type { IngestRecord } from '@/models/ingest.models';

const state = vi.hoisted(() => ({ batches: [] as ImportBatchSummary[], close: vi.fn(), ingests: [] as IngestRecord[], isOpen: true, loadChildren: vi.fn(), open: vi.fn(), sourceProgress: {}, uploadProgress: {} }));
vi.mock('@/lib/contexts/UploadContext', () => ({ useUploads: () => state }));
vi.mock('@/lib/contexts/AuthContext', () => ({ useAuth: () => ({ user: { getIdToken: async () => 'test-token' } }) }));
vi.mock('@/components/ui/Modal', () => ({ default: ({ children }: { children: ReactNode }) => createElement('section', null, children) }));
vi.mock('@/components/ui/Button', () => ({ Button: ({ children, size: _size, tone: _tone, icon: _icon, iconPosition: _position, ...props }: { children?: ReactNode; size?: string; tone?: string; icon?: ReactNode; iconPosition?: string; [key: string]: unknown }) => createElement('button', props, children) }));
import UploadCenterModal from '@/components/upload/UploadCenterModal';

const makeBatch = (label: string, outcome: ImportBatchSummary['outcome']): ImportBatchSummary => ({ batchId: label.toLowerCase().replaceAll(' ', '-'), ownerId: 'user-a', label, expectedSourceCount: 1, outcome, counters: { sources: 1, discoveredItems: 1, fonts: 1, families: 1, duplicates: 0, review: outcome === 'needs_review' ? 1 : 0, warnings: 0, failures: 0 }, phases: { upload: { state: 'uploaded' }, planning: { state: 'applying', progress: 25 } }, createdAt: 1, updatedAt: 1 });
const legacy: IngestRecord = { id: 'legacy-1', ingestId: 'legacy-1', ownerId: 'user-a', originalName: 'legacy.otf', status: 'processing', uploadState: 'uploading', analysisState: 'analyzing' };

const visibleLabels = (renderer: ReactTestRenderer) => renderer.root.findAllByType('h3').map((node) => String(node.children[0]));
const children = (): ImportBatchChildren => ({ batch: makeBatch('July archive', 'active'), familyPlans: [{ id: 'f1', familyName: 'Retry family', state: 'failed', retryable: true, attempts: 0, maxAttempts: 2 }], reviewItems: [
  { id: 'r1', filename: 'retry.otf', state: 'failed', retryable: true, attempts: 0, maxAttempts: 2 },
  { id: 'r2', filename: 'applied.otf', state: 'failed', retryable: true, attempts: 0, maxAttempts: 2, applied: true },
  { id: 'r3', filename: 'unknown.otf', state: 'failed', retryable: true, maxAttempts: 2 },
  { id: 'r4', filename: 'exhausted.otf', state: 'failed', retryable: true, attempts: 2, maxAttempts: 2 },
], familyPlansCursor: null, reviewItemsCursor: null });

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
    expect(JSON.stringify(renderer.toJSON())).toContain('Review unresolved imports');
  });

  it('mounts authenticated actions and gates retry and cancel controls from batch state', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: {} }) }));
    vi.stubGlobal('fetch', fetchMock);
    const loadChildren = vi.fn(async () => children()); state.batches = [makeBatch('July archive', 'active')]; state.ingests = []; state.loadChildren = loadChildren;
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(createElement(UploadCenterModal)); });
    await act(async () => { renderer.root.findByProps({ 'aria-controls': 'upload-batch-july-archive' }).props.onClick(); });

    expect(renderer.root.findAllByType('button').filter((node) => node.children[0] === 'Retry')).toHaveLength(2);
    const cancel = renderer.root.findAllByType('button').find((node) => node.children[0] === 'Cancel batch');
    expect(cancel).toBeDefined();
    await act(async () => { renderer.root.findAllByType('button').find((node) => node.children[0] === 'Retry')!.props.onClick(); });
    await act(async () => { cancel!.props.onClick(); });
    expect(fetchMock).toHaveBeenNthCalledWith(1, expect.stringContaining('/actions/retry'), expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-token' }) }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringContaining('/actions/cancel'), expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-token' }) }));
    vi.unstubAllGlobals();
  });

  it('keeps the legacy fallback and calculates the current phase', async () => {
    const { currentPhase } = await import('@/components/upload/UploadCenterSummary');
    state.batches = []; state.ingests = [legacy];
    expect(renderToStaticMarkup(createElement(UploadCenterModal))).toContain('legacy.otf');
    expect(currentPhase(makeBatch('July archive', 'active'))).toMatchObject({ name: 'planning', state: 'applying', progress: { percent: 25 } });
  });
});
