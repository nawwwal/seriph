export const SNAPSHOT_KINDS = [
  'shelf', 'search-index', 'semantic-search', 'family-detail', 'family-detail-aliases',
] as const;
export type SnapshotKind = typeof SNAPSHOT_KINDS[number];

export interface SnapshotRecord {
  id: string;
  accountId: string;
  kind: SnapshotKind;
  key: string;
  revision?: number;
  fetchedAt: number;
  expiresAt: number;
  lastAccessedAt: number;
  payload: unknown;
}

export interface SnapshotScope {
  accountId: string;
  kind: SnapshotKind;
  key: string;
}

export interface SnapshotWrite extends SnapshotScope {
  payload: unknown;
  revision?: number;
  ttlMs: number;
  maxEntries?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSnapshotKind(value: unknown): value is SnapshotKind {
  return SNAPSHOT_KINDS.some((kind) => kind === value);
}

export function isSnapshotRecord(value: unknown): value is SnapshotRecord {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.accountId === 'string'
    && isSnapshotKind(value.kind)
    && typeof value.key === 'string'
    && typeof value.fetchedAt === 'number'
    && typeof value.expiresAt === 'number'
    && typeof value.lastAccessedAt === 'number';
}
