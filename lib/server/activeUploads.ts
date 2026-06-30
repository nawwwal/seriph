import type { AnalysisState, IngestRecord } from '@/models/ingest.models';
import { isActiveIngest } from '@/lib/upload/activeIngests';
import { mapIngest } from '@/lib/upload/mapIngest';

export const ACTIVE_ANALYSIS_STATES: AnalysisState[] = [
  'not_started',
  'queued',
  'analyzing',
  'enriching',
  'retrying',
];

export const ACTIVE_UPLOAD_LIMIT = 100;
export const ACTIVE_UPLOAD_QUERY_LIMIT = 200;
export const ACTIVE_UPLOAD_FALLBACK_QUERY_LIMIT = 1000;

export interface IngestSnapshotLike {
  id: string;
  data: () => Record<string, unknown>;
}

interface ActiveUploadSnapshotLike {
  docs: IngestSnapshotLike[];
}

interface ActiveUploadRunnableQueryLike {
  get: () => Promise<ActiveUploadSnapshotLike>;
}

interface ActiveUploadOrderedQueryLike {
  limit: (count: number) => ActiveUploadRunnableQueryLike;
}

interface ActiveUploadFilteredQueryLike {
  orderBy: (fieldPath: 'updatedAt', direction: 'desc') => ActiveUploadOrderedQueryLike;
}

export interface ActiveUploadCollectionLike {
  where: (
    fieldPath: 'analysisState',
    operator: 'in',
    states: AnalysisState[]
  ) => ActiveUploadFilteredQueryLike;
  orderBy: (fieldPath: 'updatedAt', direction: 'desc') => ActiveUploadOrderedQueryLike;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

export function isMissingActiveUploadIndexError(error: unknown): boolean {
  if (!isRecord(error)) return false;
  const code = error.code;
  const message = typeof error.message === 'string' ? error.message : '';
  return (
    code === 9 ||
    code === 'failed-precondition' ||
    code === 'FAILED_PRECONDITION' ||
    (message.includes('requires an index') && message.includes('analysisState'))
  );
}

export async function queryActiveIngestRows(collection: ActiveUploadCollectionLike): Promise<IngestSnapshotLike[]> {
  try {
    const snap = await collection
      .where('analysisState', 'in', ACTIVE_ANALYSIS_STATES)
      .orderBy('updatedAt', 'desc')
      .limit(ACTIVE_UPLOAD_QUERY_LIMIT)
      .get();
    return snap.docs;
  } catch (error) {
    if (!isMissingActiveUploadIndexError(error)) throw error;
    const snap = await collection.orderBy('updatedAt', 'desc').limit(ACTIVE_UPLOAD_FALLBACK_QUERY_LIMIT).get();
    return snap.docs;
  }
}

export function selectActiveIngests(rows: IngestSnapshotLike[], uid: string): IngestRecord[] {
  return rows
    .map((doc) => mapIngest(doc.id, doc.data(), uid))
    .filter((ingest) => isActiveIngest(ingest))
    .slice(0, ACTIVE_UPLOAD_LIMIT);
}
