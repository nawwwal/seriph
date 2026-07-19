import { describe, expect, it } from 'vitest';
import { rebuildCatalogSummary, summarizeCatalogFamilyRecords } from '../../src/storage/catalogSummary';

type Row = Record<string, unknown>;
class FakeSnapshot {
  constructor(readonly id: string, private readonly row: Row) {}
  data() { return this.row; }
}
class FakeQuery {
  private cursor = 0; private pageSize = 0;
  constructor(private readonly rows: Row[], private readonly calls: number[]) {}
  where() { return this; }
  select() { return this; }
  orderBy() { return this; }
  startAfter(snapshot: FakeSnapshot) { this.cursor = Number(snapshot.id) + 1; return this; }
  limit(value: number) { this.pageSize = value; this.calls.push(value); return this; }
  async get() {
    const rows = this.rows.slice(this.cursor, this.cursor + this.pageSize);
    return { docs: rows.map((row, index) => new FakeSnapshot(String(this.cursor + index), row)), empty: rows.length === 0 };
  }
}
class FakeRef {
  constructor(private readonly db: FakeDb) {}
  async get() { return { exists: this.db.summary !== undefined, data: () => this.db.summary }; }
  set(value: Row) { this.db.summary = value; }
}
class FakeDb {
  summary: Row | undefined; readonly limits: number[] = [];
  constructor(readonly rows: Row[]) {}
  collection(name: string) {
    return name === 'fontfamilies' ? new FakeQuery(this.rows, this.limits) : { doc: () => new FakeRef(this) };
  }
  runTransaction = async <T>(fn: (tx: { get: (ref: FakeRef) => Promise<unknown>; set: (ref: FakeRef, value: Row) => void }) => Promise<T>) => fn({
    get: (ref) => ref.get(), set: (ref, value) => ref.set(value),
  });
}

describe('catalog summary storage', () => {
  it('excludes hidden aliases from the persisted browse summary', () => {
    expect(summarizeCatalogFamilyRecords([
      { name: 'Aster', styleCount: 3, hidden: false, createdAt: '2026-07-01T10:00:00.000Z' },
      { name: 'Alias', styleCount: 3, hidden: true, createdAt: '2026-07-02T10:00:00.000Z' },
    ], '2026-07-10T10:00:00.000Z', 7)).toEqual({
      familyCount: 1,
      styleCount: 3,
      recentFamilyName: 'Aster',
      generatedAt: '2026-07-10T10:00:00.000Z',
      updatedAt: '2026-07-10T10:00:00.000Z',
      libraryRevision: 7,
    });
  });

  it('paginates family aggregation and applies one persistent batch token once', async () => {
    const db = new FakeDb(Array.from({ length: 201 }, (_, index) => ({ name: `Family ${index}`, styleCount: 1, createdAt: `2026-07-${String((index % 9) + 1).padStart(2, '0')}` })));
    await rebuildCatalogSummary(db as never, 'owner-1', 'import-batch:owner-1:batch-1');
    await rebuildCatalogSummary(db as never, 'owner-1', 'import-batch:owner-1:batch-1');
    expect(db.limits).toContain(200);
    expect(db.summary).toMatchObject({ familyCount: 201, styleCount: 201, libraryRevision: 1, lastInvalidationToken: 'import-batch:owner-1:batch-1' });

    await rebuildCatalogSummary(db as never, 'owner-1', 'import-batch:owner-1:batch-2');
    expect(db.summary).toMatchObject({ libraryRevision: 2, lastInvalidationToken: 'import-batch:owner-1:batch-2' });
  });

  it('does not advance the revision when an earlier batch is replayed after a later batch', async () => {
    const db = new FakeDb([{ name: 'Family', styleCount: 1 }]);
    await rebuildCatalogSummary(db as never, 'owner-1', 'import-batch:owner-1:batch-a');
    await rebuildCatalogSummary(db as never, 'owner-1', 'import-batch:owner-1:batch-b');
    await rebuildCatalogSummary(db as never, 'owner-1', 'import-batch:owner-1:batch-a');
    expect(db.summary).toMatchObject({
      libraryRevision: 2,
      catalogSummaryInvalidationTokens: [
        'import-batch:owner-1:batch-a',
        'import-batch:owner-1:batch-b',
      ],
    });
  });

  it('rejects a summary count that would overflow safe integer arithmetic', () => {
    expect(() => summarizeCatalogFamilyRecords([
      { name: 'A', styleCount: Number.MAX_SAFE_INTEGER }, { name: 'B', styleCount: 1 },
    ], '2026-07-10T00:00:00.000Z', 1)).toThrow('catalog summary count overflow');
  });
});
