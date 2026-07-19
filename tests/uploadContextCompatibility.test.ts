import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ feedCompletion: undefined as ((event: { kind: 'families_applied'; batchId: string; delta: number }) => void) | undefined, value: undefined as any, callback: vi.fn() }));
vi.mock('@/lib/contexts/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'user-a' }, isLoading: false }) }));
vi.mock('@/lib/hooks/useImportBatchFeed', () => ({ useImportBatchFeed: ({ onCompletion }: { onCompletion: typeof state.feedCompletion }) => { state.feedCompletion = onCompletion; return { batches: [], activeCount: 0, transport: 'realtime', loadOlder: vi.fn() }; } }));
vi.mock('@/lib/hooks/useImportBatchChildren', () => ({ useImportBatchChildren: () => ({ children: {}, loadChildren: vi.fn(), collapse: vi.fn() }) }));
import { UploadProvider, useUploads } from '@/lib/contexts/UploadContext';

function Consumer() { state.value = useUploads(); state.value.onCompleted(state.callback); return null; }

describe('UploadContext canonical feed', () => {
  it('publishes the durable batch feed and only fires completion from that feed', () => {
    renderToStaticMarkup(createElement(UploadProvider, null, createElement(Consumer)));
    expect(state.value).toMatchObject({ batches: [], transport: 'realtime', sourceProgress: {} });
    state.feedCompletion?.({ kind: 'families_applied', batchId: 'b1', delta: 1 }); expect(state.callback).toHaveBeenCalledTimes(1);
  });
});
