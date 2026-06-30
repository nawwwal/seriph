import { describe, expect, it } from 'vitest';
import {
  ACTIVE_ANALYSIS_STATES,
  ACTIVE_UPLOAD_FALLBACK_QUERY_LIMIT,
  ACTIVE_UPLOAD_QUERY_LIMIT,
  isMissingActiveUploadIndexError,
  queryActiveIngestRows,
  type ActiveUploadCollectionLike,
} from '@/lib/server/activeUploads';

const base = { ownerId: 'user-1', originalName: 'Font.otf', status: 'uploaded', uploadState: 'uploaded' };
const row = (id: string, data: Record<string, unknown>) => ({ id, data: () => ({ ...base, ingestId: id, ...data }) });

describe('active upload Firestore query', () => {
  it('detects Firestore missing-index errors', () => {
    expect(isMissingActiveUploadIndexError({ code: 9, message: 'FAILED_PRECONDITION: The query requires an index.' })).toBe(true);
    expect(isMissingActiveUploadIndexError({ code: 'failed-precondition', message: 'The query requires an index for analysisState.' })).toBe(true);
    expect(isMissingActiveUploadIndexError({ code: 'unavailable', message: 'network unavailable' })).toBe(false);
  });

  it('falls back to a bounded recent-ingests query while the active index is unavailable', async () => {
    const docs = [row('recent-active', { analysisState: 'queued' })];
    const calls: string[] = [];
    const collection: ActiveUploadCollectionLike = {
      where(fieldPath, operator, states) {
        calls.push(`${fieldPath}:${operator}:${states.join(',')}`);
        return { orderBy: (field, direction) => ({
          limit: (count) => ({
            get: async () => {
              calls.push(`indexed:${field}:${direction}`, `indexed-limit:${count}`);
              throw { code: 9, message: 'The query requires an index for analysisState.' };
            },
          }),
        }) };
      },
      orderBy(field, direction) {
        calls.push(`fallback:${field}:${direction}`);
        return { limit: (count) => ({
          get: async () => {
            calls.push(`fallback-limit:${count}`);
            return { docs };
          },
        }) };
      },
    };

    await expect(queryActiveIngestRows(collection)).resolves.toEqual(docs);
    expect(calls).toEqual([
      `analysisState:in:${ACTIVE_ANALYSIS_STATES.join(',')}`,
      'indexed:updatedAt:desc',
      `indexed-limit:${ACTIVE_UPLOAD_QUERY_LIMIT}`,
      'fallback:updatedAt:desc',
      `fallback-limit:${ACTIVE_UPLOAD_FALLBACK_QUERY_LIMIT}`,
    ]);
  });

  it('does not hide non-index Firestore errors', async () => {
    const collection: ActiveUploadCollectionLike = {
      where: () => ({ orderBy: () => ({ limit: () => ({ get: async () => { throw new Error('network unavailable'); } }) }) }),
      orderBy: () => { throw new Error('fallback should not run'); },
    };

    await expect(queryActiveIngestRows(collection)).rejects.toThrow('network unavailable');
  });
});
