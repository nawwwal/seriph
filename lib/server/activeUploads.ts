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

export interface IngestSnapshotLike {
  id: string;
  data: () => Record<string, unknown>;
}

export function selectActiveIngests(rows: IngestSnapshotLike[], uid: string): IngestRecord[] {
  return rows
    .map((doc) => mapIngest(doc.id, doc.data(), uid))
    .filter((ingest) => isActiveIngest(ingest))
    .slice(0, ACTIVE_UPLOAD_LIMIT);
}
