import { describe, expect, it } from 'vitest';
import { isActiveIngest } from '@/lib/upload/activeIngests';
import type { IngestRecord } from '@/models/ingest.models';

function ingest(overrides: Partial<IngestRecord>): IngestRecord {
  return {
    id: 'ingest-1',
    ingestId: 'ingest-1',
    ownerId: 'user-1',
    originalName: 'Font.otf',
    status: 'uploaded',
    ...overrides,
  };
}

describe('isActiveIngest', () => {
  it('excludes terminal canceled, error, and complete rows', () => {
    expect(isActiveIngest(ingest({ uploadState: 'canceled' }))).toBe(false);
    expect(isActiveIngest(ingest({ analysisState: 'error' }))).toBe(false);
    expect(isActiveIngest(ingest({ analysisState: 'complete' }))).toBe(false);
  });

  it('keeps rows that still need upload or analysis work', () => {
    expect(isActiveIngest(ingest({ uploadState: 'pending', analysisState: 'not_started' }))).toBe(true);
    expect(isActiveIngest(ingest({ uploadState: 'uploaded', analysisState: 'enriching' }))).toBe(true);
  });
});
