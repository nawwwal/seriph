import { describe, expect, it } from 'vitest';
import { readActiveUploadResponse } from '@/lib/contexts/useActiveUploadPolling';
import type { IngestRecord } from '@/models/ingest.models';

const ingest = {
  id: 'ingest-1',
  ingestId: 'ingest-1',
  ownerId: 'user-1',
  originalName: 'Font.otf',
  status: 'uploaded',
  analysisState: 'queued',
} satisfies IngestRecord;

describe('active upload polling response parsing', () => {
  it('returns ingests from a successful API response', async () => {
    const response = Response.json({ data: { ingests: [ingest] } });

    await expect(readActiveUploadResponse(response)).resolves.toEqual({
      kind: 'available',
      ingests: [ingest],
    });
  });

  it('treats failed status responses as unavailable instead of throwing', async () => {
    const response = Response.json(
      { error: { code: 'internal_error', message: 'Failed to fetch active uploads' } },
      { status: 500 }
    );

    await expect(readActiveUploadResponse(response)).resolves.toEqual({ kind: 'unavailable' });
  });

  it('treats non-json successful responses as an empty status payload', async () => {
    const response = new Response('<html></html>', {
      headers: { 'content-type': 'text/html' },
    });

    await expect(readActiveUploadResponse(response)).resolves.toEqual({
      kind: 'available',
      ingests: [],
    });
  });
});
