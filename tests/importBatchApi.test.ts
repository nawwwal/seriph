import { describe, expect, it } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import {
  createImportBatch,
  parseBatchListQuery,
  presentBatchDetail,
} from '@/lib/server/imports/batchStore';

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
      .toEqual({ limit: 50, outcome: 'failed' });
    expect(parseBatchListQuery(new URL('https://x.test?outcome=unknown')))
      .toEqual({ limit: 30, outcome: null });
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
});
