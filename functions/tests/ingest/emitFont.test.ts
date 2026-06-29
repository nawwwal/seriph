import { describe, expect, it } from 'vitest';
import { planFontEmission } from '../../src/ingest/emitFont';

describe('planFontEmission', () => {
  it('reuses the client processing id for direct intake font uploads', () => {
    expect(planFontEmission({ fileName: 'abc123-Inter-Regular.otf', sourceProcessingId: 'abc123' })).toEqual({
      processingId: 'abc123',
      originalName: 'Inter-Regular.otf',
      shouldCreateIngest: false,
    });
  });

  it('allocates a server ingest for fonts extracted from archives', () => {
    expect(planFontEmission({ fileName: 'Inter-Regular.otf', allocatedProcessingId: 'server456' })).toEqual({
      processingId: 'server456',
      originalName: 'Inter-Regular.otf',
      shouldCreateIngest: true,
    });
  });
});
