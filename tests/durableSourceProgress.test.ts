import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement, useEffect, type ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

const stable = vi.hoisted(() => ({
  user: { uid: 'user-a', getIdToken: vi.fn().mockResolvedValue('token') },
  loadChildren: vi.fn(),
  send100: null as (() => void) | null,
  complete: null as (() => void) | null,
}));

vi.mock('@/lib/contexts/AuthContext', () => ({ useAuth: () => ({ isLoading: false, user: stable.user }) }));
vi.mock('@/lib/cache/familyDetailClient', () => ({ clearFamilyDetailNegativeCacheForUser: vi.fn() }));
vi.mock('@/lib/hooks/useImportBatchFeed', () => ({ useImportBatchFeed: () => ({ batches: [], activeCount: 0, transport: 'realtime' }) }));
vi.mock('@/lib/hooks/useImportBatchChildren', () => ({ useImportBatchChildren: () => ({ loadChildren: stable.loadChildren }) }));
vi.mock('@/lib/firebase/config', () => ({ app: {}, storage: {} }));
vi.mock('firebase/remote-config', () => ({ isSupported: vi.fn().mockResolvedValue(true), getRemoteConfig: vi.fn(() => ({})), setCustomSignals: vi.fn().mockResolvedValue(undefined), fetchAndActivate: vi.fn().mockResolvedValue(true), getValue: vi.fn(() => ({ asBoolean: () => true })) }));
vi.mock('@/lib/imports/importBatchApi', () => ({ importBatchApi: vi.fn(() => ({ create: vi.fn().mockResolvedValue({ batchId: 'batch-1' }), register: vi.fn(async (_id: string, rows: Array<{ sourceId: string; originalName: string; relativePath: string; size: number }>) => rows.map((row) => ({ ...row, accepted: true, storagePath: 'intake/one.otf' }))), seal: vi.fn().mockResolvedValue(undefined), fail: vi.fn().mockResolvedValue(undefined) })) }));
vi.mock('firebase/storage', () => ({ ref: vi.fn(), uploadBytesResumable: vi.fn(() => ({ on: (_event: string, progress: (snapshot: { bytesTransferred: number; totalBytes: number }) => void, _error: unknown, complete: () => void) => { progress({ bytesTransferred: 42, totalBytes: 100 }); stable.send100 = () => progress({ bytesTransferred: 100, totalBytes: 100 }); stable.complete = complete; } })) }));

import { UploadProvider, useUploads } from '@/lib/contexts/UploadContext';
import { useDurableBatchUpload } from '@/lib/hooks/useDurableBatchUpload';

type DurableState = ReturnType<typeof useDurableBatchUpload>;
type HarnessProps = { onReady: (state: DurableState) => void; onProgress: (progress: Record<string, number>) => void };

function Harness({ onReady, onProgress }: HarnessProps) {
  const durable = useDurableBatchUpload();
  const { sourceProgress } = useUploads();
  useEffect(() => { onReady(durable); onProgress(sourceProgress); }, [durable, onProgress, onReady, sourceProgress]);
  return null;
}

const file = { name: 'one.otf', size: 1, type: 'font/otf' } as File;
const walked = [{ file, relativePath: 'one.otf' }];
const provider = (props: ComponentProps<typeof Harness>) => createElement(UploadProvider, null, createElement(Harness, props));

describe('durable uploader source progress', () => {
  it('publishes storage progress through the real UploadProvider and removes the terminal source entry', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('sessionStorage', { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() });
    let durable!: DurableState;
    const snapshots: Array<Record<string, number>> = [];
    const onReady = (state: DurableState) => { durable = state; };
    const onProgress = (progress: Record<string, number>) => { snapshots.push(progress); };
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(provider({ onReady, onProgress })); await Promise.resolve(); await Promise.resolve(); });
    expect(durable.enabled).toBe(true);
    const uploadPromise = durable.upload(walked);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    const sourceId = Object.keys(snapshots.find((progress) => Object.values(progress).includes(42)) ?? {})[0];
    expect(snapshots.some((progress) => progress[sourceId] === 42)).toBe(true);
    await act(async () => { stable.send100?.(); await Promise.resolve(); });
    expect(snapshots.some((progress) => progress[sourceId] === 100)).toBe(true);
    await act(async () => { stable.complete?.(); await uploadPromise; });
    expect(snapshots.at(-1)).toEqual({});
    renderer.unmount();
    vi.unstubAllGlobals();
  });
});
