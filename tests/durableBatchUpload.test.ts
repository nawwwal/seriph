import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/lib/contexts/UploadContext', () => ({ useUploads: () => ({ open: vi.fn(), setUploadProgress: vi.fn() }) }));
import { prepareDurableSources, readDurableEnabled, runDurableUpload, uploadWithFallback } from '@/lib/hooks/useDurableBatchUpload';
import type { DurableUploadDeps, DurableUploadSource, RecoverySession } from '@/models/import-batch.models';

const files = (count = 2): DurableUploadSource[] => Array.from({ length: count }, (_, i) => ({ sourceId: `s${i + 1}`, file: { name: `${i + 1}.otf`, size: i + 1, type: 'font/otf' } as File, relativePath: `${i + 1}.otf` }));
const recovery: RecoverySession = { batchId: 'b1', idempotencyKey: 'key-1', sourceIds: ['s1', 's2'], sources: files().map(({ sourceId, file, relativePath }) => ({ sourceId, originalName: file.name, relativePath, size: file.size })) };
const deps = (calls: string[], upload: DurableUploadDeps['upload'] = async (source, _file, progress) => { calls.push(`upload:${source.sourceId}`); progress(50); }): DurableUploadDeps => ({
  create: async (input) => (calls.push(`create:${input.idempotencyKey}`), { batchId: 'b1' }),
  register: async (_id, sources) => (calls.push(`register:${sources.map((s) => s.sourceId).join(',')}`), sources.map((s) => ({ ...s, accepted: s.sourceId !== 's2', storagePath: s.sourceId }))),
  seal: async () => { calls.push('seal:b1'); }, resume: async (saved, sources) => (calls.push(`resume:${saved.batchId}:${saved.idempotencyKey}`), sources.map((s) => ({ ...s, accepted: true, storagePath: s.sourceId }))),
  upload, fail: async (_batch, id, failure) => { calls.push(`failure:${id}:${failure.state}`); }, progress: (id, percent) => { calls.push(`progress:${id}:${percent}`); },
});

describe('durable batch upload', () => {
  it('creates, registers in 100-source chunks, seals, skips rejected sources, and persists terminal failures', async () => {
    const calls: string[] = []; const upload: DurableUploadDeps['upload'] = async (source) => { calls.push(`upload:${source.sourceId}`); if (source.sourceId === 's3') throw new Error('network reset'); };
    await runDurableUpload(files(201), deps(calls, upload));
    expect(calls.filter((call) => call.startsWith('register:')).map((call) => call.split(':')[1]!.split(',').length)).toEqual([100, 100, 1]);
    expect(calls).toContain('seal:b1'); expect(calls).not.toContain('upload:s2'); expect(calls).toContain('failure:s3:upload_failed');
  });

  it('limits accepted uploads to four and keys controller progress by sourceId', async () => {
    const calls: string[] = []; let active = 0; let max = 0;
    const upload: DurableUploadDeps['upload'] = async (source, _file, progress) => { active++; max = Math.max(max, active); progress(42); await Promise.resolve(); active--; calls.push(`upload:${source.sourceId}`); };
    await runDurableUpload(files(6), deps(calls, upload));
    expect(max).toBe(4); expect(calls).toContain('progress:s1:42'); expect(calls).not.toContain('progress:1.otf:42');
    expect(fs.readFileSync('components/import/ImportWorkspace.tsx', 'utf8')).toContain('progressBySource');
  });

  it('reselects matching metadata and resumes its persisted batch without creating another', async () => {
    const walked = files().map(({ file, relativePath }) => ({ file, relativePath })); const prepared = prepareDurableSources(walked, recovery);
    expect(prepared.map((source) => source.sourceId)).toEqual(['s1', 's2']); const calls: string[] = [];
    await runDurableUpload(prepared, deps(calls), recovery);
    expect(calls).toContain('resume:b1:key-1'); expect(calls.some((call) => call.startsWith('create:'))).toBe(false);
  });

  it('fails closed for Remote Config and sets the signal before fetch and activate', async () => {
    const calls: string[] = []; const remote = { isSupported: async () => true, get: () => ({}), signal: async (_: unknown, value: Record<string, string>) => { calls.push(`signal:${value.seriph_user_id}`); }, activate: async () => { calls.push('activate'); }, value: () => ({ asBoolean: () => true }) };
    await expect(readDurableEnabled('u1', remote)).resolves.toBe(true); expect(calls).toEqual(['signal:u1', 'activate']);
    await expect(readDurableEnabled('u1', { ...remote, isSupported: async () => false })).resolves.toBe(false);
    await expect(readDurableEnabled('u1', { ...remote, signal: async () => { throw new Error('offline'); } })).resolves.toBe(false);
  });

  it('falls back to legacy for disabled or failed durable setup', async () => {
    const calls: string[] = []; await uploadWithFallback(files(), async () => false, async () => { calls.push('legacy:disabled'); });
    await uploadWithFallback(files(), async () => { throw new Error('api failed'); }, async () => { calls.push('legacy:failed'); });
    expect(calls).toEqual(['legacy:disabled', 'legacy:failed']);
  });
});
