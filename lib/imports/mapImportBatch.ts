export const IMPORT_BATCH_OUTCOMES = ['active', 'succeeded', 'partial', 'needs_review', 'failed', 'canceled'] as const;
export type ImportBatchOutcome = typeof IMPORT_BATCH_OUTCOMES[number];

export interface ImportBatchCounters {
  sources: number;
  discoveredItems: number;
  fonts: number;
  families: number;
  duplicates: number;
  review: number;
  warnings: number;
  failures: number;
}

export interface ImportBatchSummary {
  batchId: string;
  ownerId: string | null;
  label: string;
  expectedSourceCount: number;
  outcome: ImportBatchOutcome;
  counters: ImportBatchCounters;
  phases: Record<string, unknown>;
  createdAt: number | null;
  updatedAt: number | null;
}

export interface ImportBatchChild {
  id: string;
  [key: string]: unknown;
}

export interface ImportBatchChildren {
  batch: ImportBatchSummary | null;
  familyPlans: ImportBatchChild[];
  reviewItems: ImportBatchChild[];
  familyPlansCursor: string | null;
  reviewItemsCursor: string | null;
}

export interface FamiliesAppliedEvent {
  kind: 'families_applied';
  batchId: string;
  delta: number;
}

type Data = Record<string, unknown>;

const isRecord = (value: unknown): value is Data => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isOutcome = (value: unknown): value is ImportBatchOutcome => typeof value === 'string' && IMPORT_BATCH_OUTCOMES.includes(value as ImportBatchOutcome);
const nonNegativeInteger = (value: unknown, fallback = 0) => typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : fallback;

function millis(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (isRecord(value) && typeof value.toMillis === 'function') {
    const parsed = (value.toMillis as () => unknown)();
    return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null;
  }
  if (isRecord(value) && typeof value.toDate === 'function') {
    const date = (value.toDate as () => unknown)();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date.getTime() : null;
  }
  return null;
}

function mapCounters(value: unknown): ImportBatchCounters | null {
  if (!isRecord(value)) return null;
  return {
    sources: nonNegativeInteger(value.sources),
    discoveredItems: nonNegativeInteger(value.discoveredItems),
    fonts: nonNegativeInteger(value.fonts),
    families: nonNegativeInteger(value.families ?? value.appliedFamilies ?? value.appliedFamilyCount),
    duplicates: nonNegativeInteger(value.duplicates),
    review: nonNegativeInteger(value.review),
    warnings: nonNegativeInteger(value.warnings),
    failures: nonNegativeInteger(value.failures),
  };
}

export function mapImportBatch(value: unknown, fallbackBatchId?: string): ImportBatchSummary | null {
  if (!isRecord(value)) return null;
  const batchId = typeof value.batchId === 'string' && value.batchId ? value.batchId : fallbackBatchId;
  const label = typeof value.label === 'string' ? value.label : null;
  const expectedSourceCount = value.expectedSourceCount;
  const counters = mapCounters(value.counters);
  if (!batchId || label === null || typeof expectedSourceCount !== 'number' || !Number.isInteger(expectedSourceCount) || expectedSourceCount < 0 || !isOutcome(value.outcome) || !counters) return null;
  return {
    batchId,
    ownerId: typeof value.ownerId === 'string' ? value.ownerId : null,
    label,
    expectedSourceCount,
    outcome: value.outcome,
    counters,
    phases: isRecord(value.phases) ? value.phases : {},
    createdAt: millis(value.createdAt),
    updatedAt: millis(value.updatedAt),
  };
}

function mapChild(value: unknown, fallbackId?: string): ImportBatchChild | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === 'string' && value.id ? value.id : fallbackId;
  return id ? { id, ...value } : null;
}

function mapChildren(value: unknown): ImportBatchChild[] | null {
  if (!Array.isArray(value)) return null;
  return value.map((item) => mapChild(item)).filter((item): item is ImportBatchChild => item !== null);
}

export function mapImportBatchChildren(value: unknown): ImportBatchChildren | null {
  if (!isRecord(value)) return null;
  const familyPlans = mapChildren(value.familyPlans);
  const reviewItems = mapChildren(value.reviewItems);
  if (!familyPlans || !reviewItems) return null;
  return {
    batch: mapImportBatch(value.batch),
    familyPlans,
    reviewItems,
    familyPlansCursor: typeof value.familyPlansCursor === 'string' ? value.familyPlansCursor : null,
    reviewItemsCursor: typeof value.reviewItemsCursor === 'string' ? value.reviewItemsCursor : null,
  };
}

export function mergeImportBatches(...groups: ImportBatchSummary[][]): ImportBatchSummary[] {
  const byId = new Map<string, ImportBatchSummary>();
  for (const batch of groups.flat()) {
    const previous = byId.get(batch.batchId);
    if (!previous || (batch.updatedAt ?? 0) >= (previous.updatedAt ?? 0)) byId.set(batch.batchId, batch);
  }
  return [...byId.values()].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

export function appliedFamilyCount(batch: ImportBatchSummary): number {
  return batch.counters.families;
}

export function familiesAppliedTransition(previous: ImportBatchSummary | undefined, next: ImportBatchSummary): FamiliesAppliedEvent | null {
  if (!previous) return null;
  const delta = appliedFamilyCount(next) - appliedFamilyCount(previous);
  return delta > 0 ? { kind: 'families_applied', batchId: next.batchId, delta } : null;
}
