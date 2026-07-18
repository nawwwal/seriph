'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { collection, limit, onSnapshot, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import {
  appliedFamilyCount,
  familiesAppliedTransition,
  IMPORT_BATCH_OUTCOMES,
  mapImportBatch,
  mergeImportBatches,
  type FamiliesAppliedEvent,
  type ImportBatchSummary,
} from '@/lib/imports/mapImportBatch';

const LIVE_PAGE_SIZE = 100;
const POLL_INTERVAL = 8_000;
const HISTORY_WINDOW = 30 * 24 * 60 * 60 * 1_000;
const TERMINAL_OUTCOMES = IMPORT_BATCH_OUTCOMES.filter((outcome) => outcome !== 'active');

export type BatchFeedRows = (rows: unknown[]) => void;
export type BatchFeedError = (error: unknown) => void;
export type Unsubscribe = () => void;

export interface BatchFeedListener {
  subscribeActive(rows: BatchFeedRows, error: BatchFeedError): Unsubscribe;
  subscribeTerminal(rows: BatchFeedRows, error: BatchFeedError): Unsubscribe;
}

export interface BatchFeedPage {
  batches: unknown[];
  nextCursor: string | null;
}

export interface BatchFeedApi {
  list(cursor: string | null): Promise<BatchFeedPage>;
}

export interface BatchFeedState {
  batches: ImportBatchSummary[];
  activeCount: number;
  transport: 'realtime' | 'polling';
  nextCursor: string | null;
}

interface BatchFeedControllerOptions {
  listener: BatchFeedListener;
  api: BatchFeedApi;
  onChange?: (state: BatchFeedState) => void;
  onCompletion?: (event: FamiliesAppliedEvent) => void;
}

const emptyState = (): BatchFeedState => ({ batches: [], activeCount: 0, transport: 'realtime', nextCursor: null });

function snapshotRows(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object' || !Array.isArray((value as { docs?: unknown[] }).docs)) return [];
  return (value as { docs: Array<{ id?: string; data?: () => unknown }> }).docs.map((doc) => ({
    ...((typeof doc.data === 'function' ? doc.data() : {}) as Record<string, unknown>),
    ...(typeof doc.id === 'string' ? { batchId: doc.id } : {}),
  }));
}

function mapRows(rows: unknown[]): ImportBatchSummary[] {
  return rows.map((row) => mapImportBatch(row)).filter((batch): batch is ImportBatchSummary => batch !== null);
}

export function createBatchFeedController(options: BatchFeedControllerOptions) {
  let started = false;
  let transport: BatchFeedState['transport'] = 'realtime';
  let activeRows: ImportBatchSummary[] = [];
  let terminalRows: ImportBatchSummary[] = [];
  let fallbackRows: ImportBatchSummary[] = [];
  let olderRows: ImportBatchSummary[] = [];
  let nextCursor: string | null = null;
  let historyLoaded = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stops: Unsubscribe[] = [];
  let previous = new Map<string, ImportBatchSummary>();

  const state = (): BatchFeedState => {
    const batches = mergeImportBatches(activeRows, terminalRows, fallbackRows, olderRows);
    return { batches, activeCount: batches.filter((batch) => batch.outcome === 'active').length, transport, nextCursor };
  };

  const publish = () => {
    const next = state();
    for (const batch of next.batches) {
      const event = familiesAppliedTransition(previous.get(batch.batchId), batch);
      if (event) options.onCompletion?.(event);
    }
    previous = new Map(next.batches.map((batch) => [batch.batchId, batch]));
    options.onChange?.(next);
  };

  const stopTimer = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const stopListeners = () => {
    stops.forEach((stop) => stop());
    stops = [];
  };

  const schedulePolling = () => {
    stopTimer();
    if (started && transport === 'polling') timer = setTimeout(() => { void refreshFallback(); }, POLL_INTERVAL);
  };

  const refreshFallback = async () => {
    if (!started || transport !== 'polling') return;
    try {
      const page = await options.api.list(null);
      if (!started) return;
      fallbackRows = mapRows(page.batches);
      nextCursor = page.nextCursor;
      historyLoaded = true;
      publish();
    } finally {
      schedulePolling();
    }
  };

  const handleListenerFailure = (_error?: unknown) => {
    if (!started || transport === 'polling') return;
    transport = 'polling';
    stopListeners();
    publish();
    void refreshFallback();
  };

  const start = () => {
    if (started) return;
    started = true;
    transport = 'realtime';
    try {
      stops = [
        options.listener.subscribeActive((rows) => { activeRows = mapRows(snapshotRows(rows)); publish(); }, handleListenerFailure),
        options.listener.subscribeTerminal((rows) => { terminalRows = mapRows(snapshotRows(rows)); publish(); }, handleListenerFailure),
      ];
    } catch (error) {
      handleListenerFailure(error);
    }
    publish();
  };

  const stop = () => {
    started = false;
    stopTimer();
    stopListeners();
  };

  const loadOlder = async () => {
    if (!started || (historyLoaded && !nextCursor)) return;
    const page = await options.api.list(nextCursor);
    if (!started) return;
    olderRows = [...olderRows, ...mapRows(page.batches)];
    nextCursor = page.nextCursor;
    historyLoaded = true;
    publish();
  };

  return { start, stop, loadOlder, state };
}

const firestoreRows = (rows: BatchFeedRows) => (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => rows(snapshot.docs.map((doc) => ({ ...doc.data(), batchId: doc.id })));

export function createFirestoreBatchFeedListener(uid: string): BatchFeedListener {
  const root = collection(db, 'users', uid, 'importBatches');
  const active = query(root, where('outcome', '==', 'active'), orderBy('updatedAt', 'desc'), limit(LIVE_PAGE_SIZE));
  const terminal = query(root, where('outcome', 'in', TERMINAL_OUTCOMES), where('updatedAt', '>=', Timestamp.fromMillis(Date.now() - HISTORY_WINDOW)), orderBy('updatedAt', 'desc'), limit(LIVE_PAGE_SIZE));
  return {
    subscribeActive(rows, error) { return onSnapshot(active, firestoreRows(rows), error); },
    subscribeTerminal(rows, error) { return onSnapshot(terminal, firestoreRows(rows), error); },
  };
}

export function createImportBatchApi(user: Pick<User, 'getIdToken'>): BatchFeedApi {
  return {
    async list(cursor) {
      const token = await user.getIdToken();
      const params = new URLSearchParams({ limit: String(LIVE_PAGE_SIZE) });
      if (cursor) params.set('cursor', cursor);
      const response = await fetch(`/api/v1/import-batches?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => ({})) as { data?: { batches?: unknown[]; nextCursor?: string | null } };
      if (!response.ok) throw new Error(`Import batch history failed (${response.status})`);
      return { batches: payload.data?.batches ?? [], nextCursor: payload.data?.nextCursor ?? null };
    },
  };
}

export function useImportBatchFeed({
  user,
  isAuthLoading,
  onCompletion,
  listener,
  api,
}: {
  user: User | null;
  isAuthLoading: boolean;
  onCompletion?: (event: FamiliesAppliedEvent) => void;
  listener?: BatchFeedListener;
  api?: BatchFeedApi;
}) {
  const [feed, setFeed] = useState<BatchFeedState>(emptyState);
  const controller = useRef<ReturnType<typeof createBatchFeedController> | null>(null);
  const loadOlder = useCallback(async () => {
    await controller.current?.loadOlder();
  }, []);

  useEffect(() => {
    if (isAuthLoading || !user?.uid) {
      setFeed(emptyState());
      return;
    }
    const next = createBatchFeedController({
      listener: listener ?? createFirestoreBatchFeedListener(user.uid),
      api: api ?? createImportBatchApi(user),
      onChange: setFeed,
      onCompletion,
    });
    controller.current = next;
    next.start();
    return () => {
      next.stop();
      if (controller.current === next) controller.current = null;
    };
  }, [api, isAuthLoading, listener, onCompletion, user]);

  return { ...feed, loadOlder };
}

export { appliedFamilyCount };
