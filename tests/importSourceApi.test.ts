import { describe, expect, it } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { failImportSource, registerImportSources, sealImportBatch } from '@/lib/server/imports/sourceCommands';

type Data = Record<string, unknown>;
class Ref { constructor(readonly path: string, private db: Db) {} collection(name: string) { return { doc: (id: string) => new Ref(`${this.path}/${name}/${id}`, this.db) }; } async get() { return { exists: this.db.docs.has(this.path), data: () => this.db.docs.get(this.path) }; } }
class Tx { wrote = false; constructor(private db: Db) {} async get(ref: Ref) { if (this.wrote) throw new Error('read after write'); return ref.get(); } set(ref: Ref, data: Data) { this.wrote = true; this.db.docs.set(ref.path, data); } update(ref: Ref, data: Data) { this.wrote = true; this.db.docs.set(ref.path, { ...this.db.docs.get(ref.path), ...data }); } }
class Db { docs = new Map<string, Data>(); collection(name: string) { return { doc: (id: string) => new Ref(`${name}/${id}`, this) }; } runTransaction<T>(run: (tx: Tx) => Promise<T>) { return run(new Tx(this)); } }
const firestore = (db: Db) => db as unknown as Firestore;
const source = { sourceId: '11111111-1111-4111-8111-111111111111', originalName: 'Folder\\Font.zip', relativePath: 'Folder\\Font.zip', size: 3 };
const batch = (db: Db, expected = 2) => { db.docs.set('users/ada/importBatches/b1', { expectedSourceCount: expected, counters: { sources: 0, failures: 0 }, sealed: false }); return { ownerId: 'ada', id: 'b1' }; };
const sources = (result: Awaited<ReturnType<typeof registerImportSources>>) => { if (result.kind !== 'registered') throw new Error('expected registered'); return result.sources; };

describe('import source commands', () => {
  it('registers invalid selections as durable terminal records', async () => {
    const db = new Db(); const result = await registerImportSources(firestore(db), batch(db), [{ ...source, size: 512 * 1024 * 1024 + 1 }]);
    expect(sources(result)).toEqual([{ sourceId: source.sourceId, accepted: false, state: 'failed', errorCode: 'source_too_large' }]);
    expect(db.docs.get('users/ada/importBatches/b1/sources/' + source.sourceId)).toMatchObject({ state: 'failed', errorCode: 'source_too_large' });
  });

  it('normalizes separators, uses the exact intake path, and is idempotent', async () => {
    const db = new Db(); const input = batch(db); const first = await registerImportSources(firestore(db), input, [source]); const second = await registerImportSources(firestore(db), input, [source]);
    expect(sources(first)[0]).toEqual({ sourceId: source.sourceId, accepted: true, state: 'uploading', storagePath: 'intake/ada/b1/11111111-1111-4111-8111-111111111111/Font.zip' });
    expect(second).toEqual(first); expect(db.docs.get('users/ada/importBatches/b1')!.counters).toMatchObject({ sources: 1 });
  });

  it('rejects absolute and traversal paths without dropping their source records', async () => {
    const db = new Db(); const result = await registerImportSources(firestore(db), batch(db), [{ ...source, sourceId: '22222222-2222-4222-8222-222222222222', relativePath: '../secret' }, { ...source, sourceId: '33333333-3333-4333-8333-333333333333', relativePath: '/secret' }]);
    expect(sources(result).map((item) => item.errorCode)).toEqual(['invalid_path', 'invalid_path']);
  });

  it('makes selections beyond the two-hundred-source cap terminal records', async () => {
    const db = new Db(); const input = Array.from({ length: 201 }, (_, index) => ({ ...source, sourceId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}` }));
    const result = sources(await registerImportSources(firestore(db), batch(db, 201), input));
    expect(result).toHaveLength(201); expect(result[200]).toMatchObject({ accepted: false, state: 'failed', errorCode: 'request_source_limit' });
  });

  it('seals only after the source count matches and remains idempotent', async () => {
    const db = new Db(); const input = batch(db); await registerImportSources(firestore(db), input, [source]);
    await expect(sealImportBatch(firestore(db), input)).resolves.toEqual({ kind: 'count_mismatch', expected: 2, registered: 1 });
    db.docs.get('users/ada/importBatches/b1')!.expectedSourceCount = 1;
    await expect(sealImportBatch(firestore(db), input)).resolves.toEqual({ kind: 'sealed' });
    await expect(sealImportBatch(firestore(db), input)).resolves.toEqual({ kind: 'existing' });
  });

  it('persists only terminal client upload failures and schedules reconciliation', async () => {
    const db = new Db(); const input = batch(db, 1); await registerImportSources(firestore(db), input, [source]);
    await expect(failImportSource(firestore(db), input, source.sourceId, 'upload_failed', 'network reset')).resolves.toEqual({ kind: 'failed' });
    expect(db.docs.get('users/ada/importBatches/b1/sources/' + source.sourceId)).toMatchObject({ state: 'failed', clientFailureDetail: 'network reset' });
    expect(db.docs.get('users/ada/importBatches/b1')).toMatchObject({ reconciliation: { state: 'scheduled' } });
    await expect(failImportSource(firestore(db), input, source.sourceId, 'other', 'x')).resolves.toEqual({ kind: 'invalid_failure' });
  });
});
