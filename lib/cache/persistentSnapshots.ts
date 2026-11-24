'use client';

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { isSnapshotRecord, type SnapshotKind, type SnapshotRecord, type SnapshotScope, type SnapshotWrite } from '@/lib/cache/persistentSnapshotTypes';

export type { SnapshotKind, SnapshotRecord, SnapshotScope, SnapshotWrite } from '@/lib/cache/persistentSnapshotTypes';

interface SnapshotDb extends DBSchema {
  snapshots: {
    key: string;
    value: SnapshotRecord;
    indexes: { 'by-account': string; 'by-account-kind': [string, SnapshotKind] };
  };
}

const DATABASE_NAME = 'seriph-snapshots';
let dbPromise: Promise<IDBPDatabase<SnapshotDb>> | null = null;
let latestTimestamp = 0;

function now(): number {
  latestTimestamp = Math.max(Date.now(), latestTimestamp + 1);
  return latestTimestamp;
}

function snapshotId(scope: SnapshotScope): string {
  return `${scope.accountId}:${scope.kind}:${scope.key}`;
}

async function database(): Promise<IDBPDatabase<SnapshotDb> | null> {
  if (typeof indexedDB === 'undefined') return null;
  try {
    if (!dbPromise) {
      dbPromise = openDB<SnapshotDb>(DATABASE_NAME, 1, {
        upgrade(db) {
          const store = db.createObjectStore('snapshots', { keyPath: 'id' });
          store.createIndex('by-account', 'accountId');
          store.createIndex('by-account-kind', ['accountId', 'kind']);
        },
      });
    }
    return await dbPromise;
  } catch {
    dbPromise = null;
    return null;
  }
}

async function snapshotsFor(db: IDBPDatabase<SnapshotDb>, accountId: string, kind?: SnapshotKind) {
  return kind ? db.getAllFromIndex('snapshots', 'by-account-kind', [accountId, kind]) : db.getAllFromIndex('snapshots', 'by-account', accountId);
}

export async function listSnapshots(input: { accountId: string; kind: SnapshotKind; limit: number }): Promise<SnapshotRecord[]> {
  try {
    const db = await database();
    if (!db || input.limit < 1) return [];
    const timestamp = now();
    const records = await snapshotsFor(db, input.accountId, input.kind);
    const valid = records.filter((record) => isSnapshotRecord(record) && record.accountId === input.accountId && record.kind === input.kind && record.expiresAt > timestamp);
    const stale = records.filter((record) => !valid.includes(record));
    await Promise.all(stale.map((record) => db.delete('snapshots', record.id)));
    return valid.sort((left, right) => right.lastAccessedAt - left.lastAccessedAt).slice(0, input.limit);
  } catch {
    return [];
  }
}

export async function readSnapshot(scope: SnapshotScope): Promise<SnapshotRecord | null> {
  try {
    const db = await database();
    if (!db) return null;
    const id = snapshotId(scope);
    const record = await db.get('snapshots', id);
    if (!isSnapshotRecord(record) || record.accountId !== scope.accountId || record.expiresAt <= now()) {
      if (record) await db.delete('snapshots', id);
      return null;
    }
    const timestamp = now();
    if (timestamp - record.lastAccessedAt > 60_000) {
      void db.put('snapshots', { ...record, lastAccessedAt: timestamp }).catch(() => undefined);
    }
    return record;
  } catch {
    return null;
  }
}

export async function writeSnapshot(input: SnapshotWrite): Promise<void> {
  try {
    const db = await database();
    if (!db) return;
    const fetchedAt = now();
    await db.put('snapshots', {
      id: snapshotId(input), accountId: input.accountId, kind: input.kind, key: input.key,
      ...(input.revision === undefined ? {} : { revision: input.revision }),
      fetchedAt, expiresAt: fetchedAt + input.ttlMs, lastAccessedAt: fetchedAt, payload: input.payload,
    });
    if (!input.maxEntries) return;
    const overflow = (await snapshotsFor(db, input.accountId, input.kind)).sort((left, right) => left.lastAccessedAt - left.lastAccessedAt).slice(0, -input.maxEntries);
    await Promise.all(overflow.map((record) => db.delete('snapshots', record.id)));
  } catch { /* fallback to network cache when storage quota or private mode blocks IDB */ }
}

export async function invalidateSnapshots(input: { accountId: string; kind?: SnapshotKind }): Promise<void> {
  try {
    const db = await database();
    if (!db) return;
    const records = await snapshotsFor(db, input.accountId, input.kind);
    await Promise.all(records.map((record) => db.delete('snapshots', record.id)));
  } catch { /* best-effort cache invalidation */ }
}

export async function clearAccountSnapshots(input: { accountId: string }): Promise<void> {
  await invalidateSnapshots(input);
}
