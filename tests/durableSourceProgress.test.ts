import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

const observed = vi.hoisted(() => ({
  map: {} as Record<string, number>,
  events: [] as Array<[string, number | null]>,
  state: null as ReturnType<typeof import('@/lib/hooks/useDurableBatchUpload').useDurableBatchUpload> | null,
  open: vi.fn(),
  setSourceProgress: (id: string, percent: number | null) => { observed.events.push([id, percent]); if (percent === null) delete observed.map[id]; else observed.map[id] = percent; },
  user: { uid: 'user-a', getIdToken: vi.fn().mockResolvedValue('token') },
}));

vi.mock('@/lib/contexts/AuthContext', () => ({ useAuth: () => ({ isLoading: false, user: observed.user }) }));
vi.mock('@/lib/contexts/UploadContext', () => ({ useUploads: () => ({ open: observed.open, setSourceProgress: observed.setSourceProgress }) }));
vi.mock('@/lib/firebase/config', () => ({ app: {}, storage: {} }));
vi.mock('firebase/remote-config', () => ({ isSupported: vi.fn().mockResolvedValue(true), getRemoteConfig: vi.fn(() => ({})), setCustomSignals: vi.fn().mockResolvedValue(undefined), fetchAndActivate: vi.fn().mockResolvedValue(true), getValue: vi.fn(() => ({ asBoolean: () => true })) }));
vi.mock('@/lib/imports/importBatchApi', () => ({ importBatchApi: vi.fn(() => ({ create: vi.fn().mockResolvedValue({ batchId: 'batch-1' }), register: vi.fn(async (_id: string, rows: Array<{ sourceId: string; originalName: string; relativePath: string; size: number }>) => rows.map((row) => ({ ...row, accepted: true, storagePath: 'intake/one.otf' }))), seal: vi.fn().mockResolvedValue(undefined), fail: vi.fn().mockResolvedValue(undefined) })) }));
vi.mock('firebase/storage', () => ({ ref: vi.fn(), uploadBytesResumable: vi.fn(() => ({ on: (_event: string, progress: (snapshot: { bytesTransferred: number; totalBytes: number }) => void, _error: unknown, complete: () => void) => { progress({ bytesTransferred: 42, totalBytes: 100 }); complete(); } })) }));

import { useDurableBatchUpload } from '@/lib/hooks/useDurableBatchUpload';

function HookHarness() {
  observed.state = useDurableBatchUpload();
  return null;
}

const file = { name: 'one.otf', size: 1, type: 'font/otf' } as File;
const walked = [{ file, relativePath: 'one.otf' }];

describe('durable uploader source progress', () => {
  it('publishes storage progress through the mounted upload hook and clears the live context overlay', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('sessionStorage', { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() });
    observed.map = {}; observed.events = [];
    let renderer: ReactTestRenderer;
    await act(async () => { renderer = create(createElement(HookHarness)); await Promise.resolve(); await Promise.resolve(); });
    expect(observed.state?.enabled).toBe(true);
    await act(async () => { await observed.state!.upload(walked); });
    const sourceId = observed.events[0]![0];
    expect(observed.events).toEqual([[sourceId, 42], [sourceId, 100], [sourceId, null]]);
    expect(observed.map).toEqual({});
    renderer!.unmount();
    vi.unstubAllGlobals();
  });
});
