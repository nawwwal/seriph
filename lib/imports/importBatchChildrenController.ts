import { sanitizePublicImportValue } from '@/lib/imports/sanitizeImportBatch';
import type { ImportBatchChild, ImportBatchChildren } from '@/lib/imports/mapImportBatch';

export type ImportBatchChildKind = 'familyPlans' | 'reviewItems';
export type ImportBatchChildrenRows = (rows: unknown[]) => void;
export interface ImportBatchChildrenListener { subscribe(batchId: string, kind: ImportBatchChildKind, rows: ImportBatchChildrenRows, error: (error: unknown) => void): () => void; }
export interface ImportBatchChildrenApi { get(batchId: string): Promise<ImportBatchChildren>; }
export const CHILDREN_LOAD_CANCELLED = 'Import batch children load cancelled';
const emptyChildren = (): ImportBatchChildren => ({ batch: null, familyPlans: [], reviewItems: [], familyPlansCursor: null, reviewItemsCursor: null });
const publicChild = (value: unknown): ImportBatchChild | null => { const safe = sanitizePublicImportValue(value); return safe && typeof safe === 'object' && typeof (safe as { id?: unknown }).id === 'string' ? safe as ImportBatchChild : null; };

export function createImportBatchChildrenController({ listener, api }: { listener: ImportBatchChildrenListener; api?: ImportBatchChildrenApi }) {
  let expanded: string | null = null; let stops: Array<() => void> = []; let result = emptyChildren(); let resolvePending: ((value: ImportBatchChildren) => void) | null = null; let rejectPending: ((reason: Error) => void) | null = null; let seen = new Set<ImportBatchChildKind>(); let fallbackStarted = false;
  const settleCancel = () => { rejectPending?.(new Error(CHILDREN_LOAD_CANCELLED)); resolvePending = null; rejectPending = null; };
  const collapse = (batchId?: string) => { if (batchId && expanded !== batchId) return; settleCancel(); stops.forEach((stop) => stop()); stops = []; expanded = null; seen = new Set(); fallbackStarted = false; };
  const loadChildren = (batchId: string): Promise<ImportBatchChildren> => { if (expanded === batchId && seen.size === 2) return Promise.resolve(result); collapse(); expanded = batchId; result = emptyChildren(); return new Promise((resolve, reject) => {
    resolvePending = resolve; rejectPending = reject;
    const settle = (value: ImportBatchChildren) => { result = value; resolvePending?.(value); resolvePending = null; rejectPending = null; };
    const receive = (kind: ImportBatchChildKind, rows: unknown[]) => { if (expanded !== batchId) return; result = { ...result, [kind]: rows.map(publicChild).filter((item): item is ImportBatchChild => item !== null) }; seen.add(kind); if (seen.size === 2) settle(result); };
    const fallback = () => { if (!api || fallbackStarted || expanded !== batchId) return; fallbackStarted = true; void api.get(batchId).then(settle).catch((error) => { if (expanded === batchId) { rejectPending?.(error); resolvePending = null; rejectPending = null; } }); };
    for (const kind of ['familyPlans', 'reviewItems'] as const) { try { stops.push(listener.subscribe(batchId, kind, (rows) => receive(kind, rows), fallback)); } catch { fallback(); } }
  }); };
  return { loadChildren, collapse, close: () => collapse() };
}
