import { describe, expect, it } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import {
  createImportBatch,
  decodeCursor,
  listImportBatches,
  parseBatchListQuery,
  presentBatchDetail,
} from '@/lib/server/imports/batchStore';
import { parseCreateBatchBody } from '@/app/api/v1/import-batches/route';

type Data = Record<string, unknown>;
class Ref {
  constructor(readonly path: string, private readonly db: Db) {}
  collection(name: string) { return { doc: (id: string) => new Ref(`${this.path}/${name}/${id}`, this.db) }; }
  async get() { return { exists: this.db.docs.has(this.path), data: () => this.db.docs.get(this.path) }; }
}
class Tx {
  wrote = false;
  constructor(private readonly db: Db) {}
  async get(ref: Ref) { if (this.wrote) throw new Error('read after write'); return ref.get(); }
  set(ref: Ref, data: Data) { this.wrote = true; this.db.docs.set(ref.path, data); }
}
class Db {
  docs = new Map<string, Data>();
  collection(name: string) { return { doc: (id: string) => new Ref(`${name}/${id}`, this) }; }
  runTransaction<T>(run: (tx: Tx) => Promise<T>) { return run(new Tx(this)); }
}
const command = { ownerId: 'ada', idempotencyKey: 'july-1', label: 'July import', expectedSourceCount: 2 };
const firestore = (db: Db) => db as unknown as Firestore;

describe('import batch API helpers', () => {
  it('returns the existing batch for a repeated idempotency key', async () => {
    const db = new Db();
    const first = await createImportBatch(firestore(db), command);
    const second = await createImportBatch(firestore(db), command);
    expect(second).toEqual(first);
  });

  it('rejects a changed command body for an existing idempotency key', async () => {
    const db = new Db();
    await createImportBatch(firestore(db), command);
    await expect(createImportBatch(firestore(db), { ...command, label: 'August import' }))
      .resolves.toEqual({ kind: 'conflict' });
  });

  it('caps recent-history reads at fifty and allowlists outcomes', () => {
    expect(parseBatchListQuery(new URL('https://x.test?limit=500&outcome=failed')))
      .toEqual({ limit: 50, outcome: 'failed', cursor: null });
    expect(parseBatchListQuery(new URL('https://x.test?outcome=unknown')))
      .toEqual({ limit: 30, outcome: null, cursor: null });
    const parsed = parseBatchListQuery(new URL('https://x.test?cursor=eyJpZCI6ImIxIn0'));
    expect(parsed.cursor).toBe('b1');
    expect(parseBatchListQuery(new URL('https://x.test?cursor=eyJpZCI6ImIvMSJ9')).cursor).toBeNull();
  });

  it('uses the owner batch cursor to continue list pages without a gap', async () => {
    const ids = ['b3', 'b2', 'b1']; let after = ''; let limit = 0;
    const query: any = { orderBy: () => query, where: () => query, startAfter: (doc: { id: string }) => { after = doc.id; return query; }, limit: (value: number) => { limit = value; return query; }, get: async () => ({ docs: ids.slice(after ? ids.indexOf(after) + 1 : 0, (after ? ids.indexOf(after) + 1 : 0) + limit).map((id) => ({ id, data: () => ({}) })) }) };
    const db = { collection: () => ({ doc: () => ({ collection: () => ({ ...query, doc: (id: string) => ({ id, get: async () => ({ exists: ids.includes(id), id }) }) }) }) }) };
    const first = await listImportBatches(db as unknown as Firestore, 'ada', { limit: 2, outcome: null, cursor: null });
    const second = await listImportBatches(db as unknown as Firestore, 'ada', { limit: 2, outcome: null, cursor: decodeCursor(first.nextCursor) });
    expect([first, second].flatMap((page) => page.batches).map((batch) => (batch as Data).batchId)).toEqual(ids);
    expect(decodeCursor(first.nextCursor)).toBe('b2');
  });

  it('bounds detail children and removes private storage fields', () => {
    const detail = presentBatchDetail({ batchId: 'b1', storagePath: 'private/a' },
      Array.from({ length: 101 }, (_, index) => ({ id: index, storagePath: `private/${index}` })),
      Array.from({ length: 101 }, (_, index) => ({ id: index, privateStorageUrl: `https://private/${index}` })));
    expect(detail.familyPlans).toHaveLength(100);
    expect(detail.reviewItems).toHaveLength(100);
    expect(JSON.stringify(detail)).not.toMatch(/storagePath|privateStorageUrl/);
    expect(detail).toMatchObject({ familyPlansCursor: expect.any(String), reviewItemsCursor: expect.any(String) });
  });

  it('continues detail children from 100 without skipping the first unseen item', () => {
    const rows = Array.from({ length: 201 }, (_, id) => ({ id }));
    const first = presentBatchDetail({}, rows.slice(0, 101), []);
    const next = Number(decodeCursor(first.familyPlansCursor));
    const second = presentBatchDetail({}, rows.slice(next + 1), []);
    expect([...first.familyPlans, ...second.familyPlans].map((item) => (item as Data).id))
      .toEqual(Array.from({ length: 200 }, (_, id) => id));
  });

  it('rejects POST bodies with keys outside the canonical command', () => {
    expect(parseCreateBatchBody({ label: 'July', expectedSourceCount: 2 })).toEqual({ label: 'July', expectedSourceCount: 2 });
    expect(parseCreateBatchBody({ label: 'July', expectedSourceCount: 2, ignored: true })).toBeNull();
  });
});
