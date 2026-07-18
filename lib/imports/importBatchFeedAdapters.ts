import type { User } from 'firebase/auth';
import { collection, limit, onSnapshot, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { IMPORT_BATCH_OUTCOMES } from '@/lib/imports/mapImportBatch';
import type { BatchFeedApi, BatchFeedListener, BatchFeedRows } from '@/lib/imports/importBatchFeedController';

export const LIVE_PAGE_SIZE = 100;
export const HISTORY_WINDOW = 30 * 24 * 60 * 60 * 1_000;
export const TERMINAL_OUTCOMES = IMPORT_BATCH_OUTCOMES.filter((outcome) => outcome !== 'active');

export function createBatchFeedQuerySpec(now = Date.now()) {
  return { active: { limit: LIVE_PAGE_SIZE }, terminal: { limit: LIVE_PAGE_SIZE, since: now - HISTORY_WINDOW, outcomes: TERMINAL_OUTCOMES } };
}

const firestoreRows = (rows: BatchFeedRows) => (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => rows(snapshot.docs.map((doc) => ({ ...doc.data(), batchId: doc.id })));

export function createFirestoreBatchFeedListener(uid: string): BatchFeedListener {
  const root = collection(db, 'users', uid, 'importBatches'); const spec = createBatchFeedQuerySpec();
  const active = query(root, where('outcome', '==', 'active'), orderBy('updatedAt', 'desc'), limit(spec.active.limit));
  const terminal = query(root, where('outcome', 'in', spec.terminal.outcomes), where('updatedAt', '>=', Timestamp.fromMillis(spec.terminal.since)), orderBy('updatedAt', 'desc'), limit(spec.terminal.limit));
  return { subscribeActive(rows, error) { return onSnapshot(active, firestoreRows(rows), error); }, subscribeTerminal(rows, error) { return onSnapshot(terminal, firestoreRows(rows), error); } };
}

export function createImportBatchApi(user: Pick<User, 'getIdToken'>): BatchFeedApi {
  return { async list(cursor) {
    const token = await user.getIdToken(); const params = new URLSearchParams({ limit: String(LIVE_PAGE_SIZE) }); if (cursor) params.set('cursor', cursor);
    const response = await fetch(`/api/v1/import-batches?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } }); const payload = await response.json().catch(() => ({})) as { data?: { batches?: unknown[]; nextCursor?: string | null } };
    if (!response.ok) throw new Error(`Import batch history failed (${response.status})`);
    return { batches: payload.data?.batches ?? [], nextCursor: payload.data?.nextCursor ?? null };
  } };
}
