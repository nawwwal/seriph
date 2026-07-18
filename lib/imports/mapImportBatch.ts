import { sanitizePublicImportValue } from '@/lib/imports/sanitizeImportBatch';

export const IMPORT_BATCH_OUTCOMES = ['active', 'succeeded', 'partial', 'needs_review', 'failed', 'canceled'] as const;
export type ImportBatchOutcome = typeof IMPORT_BATCH_OUTCOMES[number];
export interface ImportBatchCounters { sources: number; discoveredItems: number; fonts: number; families: number; duplicates: number; review: number; warnings: number; failures: number; }
export interface ImportBatchSummary { batchId: string; ownerId: string | null; label: string; expectedSourceCount: number; outcome: ImportBatchOutcome; counters: ImportBatchCounters; phases: Record<string, unknown>; createdAt: number | null; updatedAt: number | null; }
export interface ImportBatchChild { id: string; [key: string]: unknown; }
export interface ImportBatchChildren { batch: ImportBatchSummary | null; familyPlans: ImportBatchChild[]; reviewItems: ImportBatchChild[]; familyPlansCursor: string | null; reviewItemsCursor: string | null; }
export interface FamiliesAppliedEvent { kind: 'families_applied'; batchId: string; delta: number; }
type Data = Record<string, unknown>;
const isRecord = (value: unknown): value is Data => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isOutcome = (value: unknown): value is ImportBatchOutcome => typeof value === 'string' && IMPORT_BATCH_OUTCOMES.includes(value as ImportBatchOutcome);
const nonNegativeInteger = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
const millis = (value: unknown): number | null => { if (typeof value === 'number' && Number.isFinite(value)) return value; if (typeof value === 'string') { const parsed = Date.parse(value); return Number.isNaN(parsed) ? null : parsed; } if (isRecord(value) && typeof value.toMillis === 'function') { const parsed = (value.toMillis as () => unknown)(); return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null; } if (isRecord(value) && typeof value.toDate === 'function') { const date = (value.toDate as () => unknown)(); return date instanceof Date && !Number.isNaN(date.getTime()) ? date.getTime() : null; } return null; };
const counters = (value: unknown): ImportBatchCounters | null => { if (!isRecord(value)) return null; return { sources: nonNegativeInteger(value.sources), discoveredItems: nonNegativeInteger(value.discoveredItems), fonts: nonNegativeInteger(value.fonts), families: nonNegativeInteger(value.families ?? value.appliedFamilies ?? value.appliedFamilyCount), duplicates: nonNegativeInteger(value.duplicates), review: nonNegativeInteger(value.review), warnings: nonNegativeInteger(value.warnings), failures: nonNegativeInteger(value.failures) }; };

export function mapImportBatch(value: unknown, fallbackBatchId?: string): ImportBatchSummary | null {
  if (!isRecord(value)) return null; const batchId = typeof value.batchId === 'string' && value.batchId ? value.batchId : fallbackBatchId; const count = value.expectedSourceCount; const mappedCounters = counters(value.counters);
  if (!batchId || typeof value.label !== 'string' || typeof count !== 'number' || !Number.isInteger(count) || count < 0 || !isOutcome(value.outcome) || !mappedCounters) return null;
  return { batchId, ownerId: typeof value.ownerId === 'string' ? value.ownerId : null, label: value.label, expectedSourceCount: count, outcome: value.outcome, counters: mappedCounters, phases: (sanitizePublicImportValue(value.phases) as Record<string, unknown> | undefined) ?? {}, createdAt: millis(value.createdAt), updatedAt: millis(value.updatedAt) };
}

const child = (value: unknown): ImportBatchChild | null => { const safe = sanitizePublicImportValue(value); return isRecord(safe) && typeof safe.id === 'string' && safe.id ? safe as ImportBatchChild : null; };
const childList = (value: unknown) => Array.isArray(value) ? value.map(child).filter((item): item is ImportBatchChild => item !== null) : null;

export function mapImportBatchChildren(value: unknown): ImportBatchChildren | null {
  if (!isRecord(value)) return null; const familyPlans = childList(value.familyPlans); const reviewItems = childList(value.reviewItems); if (!familyPlans || !reviewItems) return null;
  return { batch: mapImportBatch(value.batch), familyPlans, reviewItems, familyPlansCursor: typeof value.familyPlansCursor === 'string' ? value.familyPlansCursor : null, reviewItemsCursor: typeof value.reviewItemsCursor === 'string' ? value.reviewItemsCursor : null };
}

export function mergeImportBatches(...groups: ImportBatchSummary[][]): ImportBatchSummary[] { const byId = new Map<string, ImportBatchSummary>(); groups.flat().forEach((batch) => { const previous = byId.get(batch.batchId); if (!previous || (batch.updatedAt ?? 0) >= (previous.updatedAt ?? 0)) byId.set(batch.batchId, batch); }); return [...byId.values()].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)); }
export function appliedFamilyCount(batch: ImportBatchSummary): number { return batch.counters.families; }
export function familiesAppliedTransition(previous: ImportBatchSummary | undefined, next: ImportBatchSummary): FamiliesAppliedEvent | null { const delta = previous ? appliedFamilyCount(next) - appliedFamilyCount(previous) : 0; return delta > 0 ? { kind: 'families_applied', batchId: next.batchId, delta } : null; }
