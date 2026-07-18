import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ feedCompletion: undefined as ((event: { kind: 'families_applied'; batchId: string; delta: number }) => void) | undefined, legacyCompletion: undefined as (() => void) | undefined, value: undefined as any, callback: vi.fn() }));
vi.mock('@/lib/contexts/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'user-a' }, isLoading: false }) }));
vi.mock('@/lib/hooks/useImportBatchFeed', () => ({ useImportBatchFeed: ({ onCompletion }: { onCompletion: typeof state.feedCompletion }) => { state.feedCompletion = onCompletion; return { batches: [], activeCount: 0, transport: 'realtime', loadOlder: vi.fn() }; } }));
vi.mock('@/lib/hooks/useImportBatchChildren', () => ({ useImportBatchChildren: () => ({ children: {}, loadChildren: vi.fn(), collapse: vi.fn() }) }));
vi.mock('@/lib/contexts/useActiveUploadPolling', () => ({ useActiveUploadPolling: ({ onCompleted }: { onCompleted: () => void }) => { state.legacyCompletion = onCompleted; return []; } }));
import { UploadProvider, useUploads } from '@/lib/contexts/UploadContext';

function Consumer() { state.value = useUploads(); state.value.onCompleted(state.callback); return null; }

describe('UploadContext durable compatibility', () => {
  it('retains legacy fields but ignores legacy disappearance for durable callbacks', () => {
    renderToStaticMarkup(createElement(UploadProvider, null, createElement(Consumer)));
    expect(state.value).toMatchObject({ batches: [], transport: 'realtime', sourceProgress: {}, uploadProgress: {} });
    expect(state.value.setSourceProgress).not.toBe(state.value.setUploadProgress);
    state.legacyCompletion?.(); expect(state.callback).not.toHaveBeenCalled();
    state.feedCompletion?.({ kind: 'families_applied', batchId: 'b1', delta: 1 }); expect(state.callback).toHaveBeenCalledTimes(1);
  });
});
