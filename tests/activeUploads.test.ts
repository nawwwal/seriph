import { describe, expect, it } from 'vitest';
import {
  ACTIVE_ANALYSIS_STATES,
  ACTIVE_UPLOAD_LIMIT,
  selectActiveIngests,
} from '@/lib/server/activeUploads';

const base = {
  ownerId: 'user-1',
  originalName: 'Font.otf',
  status: 'uploaded',
  uploadState: 'uploaded',
};

function row(id: string, data: Record<string, unknown>) {
  return { id, data: () => ({ ...base, ingestId: id, ...data }) };
}

describe('active upload selection', () => {
  it('queries only analysis states that can still be active', () => {
    expect(ACTIVE_ANALYSIS_STATES).toEqual([
      'not_started',
      'queued',
      'analyzing',
      'enriching',
      'retrying',
    ]);
  });

  it('filters terminal rows after the bounded Firestore query', () => {
    const selected = selectActiveIngests(
      [
        row('queued', { analysisState: 'queued' }),
        row('complete', { analysisState: 'complete' }),
        row('canceled', { analysisState: 'not_started', uploadState: 'canceled' }),
      ],
      'user-1'
    );

    expect(selected.map((ingest) => ingest.ingestId)).toEqual(['queued']);
  });

  it('keeps the response bounded for the upload center', () => {
    const rows = Array.from({ length: ACTIVE_UPLOAD_LIMIT + 5 }, (_, index) =>
      row(`ingest-${index}`, { analysisState: 'enriching' })
    );

    expect(selectActiveIngests(rows, 'user-1')).toHaveLength(ACTIVE_UPLOAD_LIMIT);
  });
});
