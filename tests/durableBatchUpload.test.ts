import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/lib/contexts/UploadContext', () => ({ useUploads: () => ({ open: vi.fn(), setUploadProgress: vi.fn() }) }));
import { runDurableUpload } from '@/lib/hooks/useDurableBatchUpload';
import type { DurableUploadDeps } from '@/models/import-batch.models';

const fixtureFiles = [
  { sourceId: 's1', file: { name: 'One.otf', size: 1, type: 'font/otf' } as File, relativePath: 'One.otf' },
  { sourceId: 's2', file: { name: 'Two.otf', size: 2, type: 'font/otf' } as File, relativePath: 'Two.otf' },
];

describe('durable batch upload', () => {
  it('creates, registers, seals, uploads accepted sources, and persists failures', async () => {
    const calls: string[] = [];
    const deps: DurableUploadDeps = {
      create: async () => (calls.push('create:b1'), { batchId: 'b1' }),
      register: async (_batchId, sources) => (calls.push(`register:${sources.map((s) => s.sourceId).join(',')}`), sources.map((source) => ({ ...source, accepted: true, storagePath: source.sourceId }))),
      seal: async () => { calls.push('seal:b1'); },
      upload: async (source) => { calls.push(`upload:${source.sourceId}`); if (source.sourceId === 's2') throw new Error('network reset'); },
      fail: async (_batchId, sourceId, failure) => { calls.push(`failure:${sourceId}:${failure.state}`); },
    };

    await runDurableUpload(fixtureFiles, deps);

    expect(calls).toEqual(['create:b1', 'register:s1,s2', 'seal:b1', 'upload:s1', 'upload:s2', 'failure:s2:upload_failed']);
  });
});
