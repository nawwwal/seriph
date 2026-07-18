import { familiesAppliedTransition, mapImportBatch, mergeImportBatches, type FamiliesAppliedEvent, type ImportBatchSummary } from '@/lib/imports/mapImportBatch';

export type BatchFeedRows = (rows: unknown[]) => void;
export type BatchFeedError = (error: unknown) => void;
export type Unsubscribe = () => void;
export interface BatchFeedListener { subscribeActive(rows: BatchFeedRows, error: BatchFeedError): Unsubscribe; subscribeTerminal(rows: BatchFeedRows, error: BatchFeedError): Unsubscribe; }
export interface BatchFeedPage { batches: unknown[]; nextCursor: string | null; }
export interface BatchFeedApi { list(cursor: string | null): Promise<BatchFeedPage>; }
export interface BatchFeedState { batches: ImportBatchSummary[]; activeCount: number; transport: 'realtime' | 'polling'; nextCursor: string | null; }
interface Options { listener: BatchFeedListener; api: BatchFeedApi; onChange?: (state: BatchFeedState) => void; onCompletion?: (event: FamiliesAppliedEvent) => void; }

const POLL_INTERVAL = 8_000;
const emptyState = (): BatchFeedState => ({ batches: [], activeCount: 0, transport: 'realtime', nextCursor: null });
const rows = (value: unknown): unknown[] => Array.isArray(value) ? value : value && typeof value === 'object' && Array.isArray((value as { docs?: unknown[] }).docs) ? (value as { docs: Array<{ id?: string; data?: () => unknown }> }).docs.map((doc) => ({ ...((typeof doc.data === 'function' ? doc.data() : {}) as Record<string, unknown>), ...(doc.id ? { batchId: doc.id } : {}) })) : [];
const mapped = (value: unknown[]) => value.map((row) => mapImportBatch(row)).filter((batch): batch is ImportBatchSummary => batch !== null);

export function createBatchFeedController(options: Options) {
  let started = false; let transport: BatchFeedState['transport'] = 'realtime'; let active: ImportBatchSummary[] = []; let terminal: ImportBatchSummary[] = []; let fallback: ImportBatchSummary[] = []; let older: ImportBatchSummary[] = []; let nextCursor: string | null = null; let historyLoaded = false; let timer: ReturnType<typeof setTimeout> | null = null; let stops: Unsubscribe[] = []; let previous = new Map<string, ImportBatchSummary>();
  const state = (): BatchFeedState => { const batches = mergeImportBatches(active, terminal, fallback, older); return { batches, activeCount: batches.filter((batch) => batch.outcome === 'active').length, transport, nextCursor }; };
  const publish = () => { const next = state(); next.batches.forEach((batch) => { const event = familiesAppliedTransition(previous.get(batch.batchId), batch); if (event) options.onCompletion?.(event); }); previous = new Map(next.batches.map((batch) => [batch.batchId, batch])); options.onChange?.(next); };
  const stopTimer = () => { if (timer) clearTimeout(timer); timer = null; };
  const stopListeners = () => { stops.forEach((stop) => stop()); stops = []; };
  const schedule = () => { stopTimer(); if (started && transport === 'polling') timer = setTimeout(() => { void refresh(); }, POLL_INTERVAL); };
  const refresh = async () => { if (!started || transport !== 'polling') return; try { const page = await options.api.list(null); if (!started) return; fallback = mapped(page.batches); if (!historyLoaded) { nextCursor = page.nextCursor; historyLoaded = true; } publish(); } catch { /* retry on the next scheduled poll */ } finally { schedule(); } };
  const failure = () => { if (!started || transport === 'polling') return; transport = 'polling'; stopListeners(); publish(); void refresh(); };
  const start = () => { if (started) return; started = true; try { stops = [options.listener.subscribeActive((value) => { active = mapped(rows(value)); publish(); }, failure), options.listener.subscribeTerminal((value) => { terminal = mapped(rows(value)); publish(); }, failure)]; } catch { failure(); } publish(); };
  const stop = () => { started = false; stopTimer(); stopListeners(); };
  const loadOlder = async () => { if (!started) return; if (!historyLoaded) { const page = await options.api.list(null); if (!started) return; fallback = mapped(page.batches); nextCursor = page.nextCursor; historyLoaded = true; publish(); return; } if (!nextCursor) return; const page = await options.api.list(nextCursor); if (!started) return; older = [...older, ...mapped(page.batches)]; nextCursor = page.nextCursor; publish(); };
  return { start, stop, loadOlder, state, emptyState };
}
