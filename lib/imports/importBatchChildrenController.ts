import type { ImportBatchChildren } from '@/lib/imports/mapImportBatch';

export type ImportBatchChildKind = 'sources' | 'items' | 'plans';
export type ImportBatchChildrenRows = (rows: unknown[]) => void;
export interface ImportBatchChildrenListener {
  subscribe(batchId: string, kind: ImportBatchChildKind, rows: ImportBatchChildrenRows, error: (error: unknown) => void): () => void;
}
export interface ImportBatchChildrenApi {
  get(batchId: string): Promise<ImportBatchChildren>;
}
export const CHILDREN_LOAD_CANCELLED = 'Import batch children load cancelled';
const emptyChildren = (): ImportBatchChildren => ({ batch: null, familyPlans: [], reviewItems: [], familyPlansCursor: null, reviewItemsCursor: null });

export function createImportBatchChildrenController({ listener, api, onChange }: { listener: ImportBatchChildrenListener; api?: ImportBatchChildrenApi; onChange?: (batchId: string, value: ImportBatchChildren) => void }) {
  let expanded: string | null = null;
  let stops: Array<() => void> = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight = false;
  let queued = false;
  let result = emptyChildren();
  let resolvePending: ((value: ImportBatchChildren) => void) | null = null;
  let rejectPending: ((reason: Error) => void) | null = null;
  const clearTimer = () => { if (timer) { clearTimeout(timer); timer = null; } };
  const settleCancel = () => { rejectPending?.(new Error(CHILDREN_LOAD_CANCELLED)); resolvePending = null; rejectPending = null; };
  const collapse = (batchId?: string) => {
    if (batchId && expanded !== batchId) return;
    clearTimer(); settleCancel(); stops.forEach((stop) => stop()); stops = []; expanded = null; inFlight = false; queued = false;
  };
  const fetchLatest = (batchId: string) => {
    if (!api || expanded !== batchId) return;
    if (inFlight) { queued = true; return; }
    inFlight = true;
    void api.get(batchId).then((value) => {
      if (expanded !== batchId) return;
      result = value;
      onChange?.(batchId, value);
      resolvePending?.(value); resolvePending = null; rejectPending = null;
    }).catch((error) => {
      if (expanded !== batchId) return;
      rejectPending?.(error instanceof Error ? error : new Error('Failed to load batch details'));
      resolvePending = null; rejectPending = null;
    }).finally(() => {
      inFlight = false;
      if (queued && expanded === batchId) { queued = false; fetchLatest(batchId); }
    });
  };
  const scheduleFetch = (batchId: string) => {
    if (expanded !== batchId) return;
    clearTimer();
    timer = setTimeout(() => { timer = null; fetchLatest(batchId); }, 80);
  };
  const loadChildren = (batchId: string): Promise<ImportBatchChildren> => {
    if (expanded === batchId) return Promise.resolve(result);
    collapse();
    expanded = batchId;
    result = emptyChildren();
    return new Promise((resolve, reject) => {
      resolvePending = resolve; rejectPending = reject;
      for (const kind of ['sources', 'items', 'plans'] as const) {
        try { stops.push(listener.subscribe(batchId, kind, () => scheduleFetch(batchId), () => scheduleFetch(batchId))); }
        catch { scheduleFetch(batchId); }
      }
      fetchLatest(batchId);
    });
  };
  return { loadChildren, collapse, close: () => collapse() };
}
