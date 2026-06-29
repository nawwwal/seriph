import type { IngestRecord } from '@/models/ingest.models';
import { getCombinedStatus } from '@/lib/upload/combinedStatus';

export function isActiveIngest(ingest: IngestRecord, uploadProgress?: number): boolean {
  const { stage } = getCombinedStatus(ingest.uploadState, ingest.analysisState, uploadProgress);
  return stage !== 'complete' && stage !== 'error' && stage !== 'canceled';
}
