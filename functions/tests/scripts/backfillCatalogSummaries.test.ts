import { describe, expect, it } from 'vitest';
import { parseCatalogSummaryBackfillArgs } from '../../src/scripts/backfillCatalogSummaries';

describe('catalog summary backfill args', () => {
  it('accepts a targeted dry run before any summary writes', () => {
    expect(parseCatalogSummaryBackfillArgs(['--ownerId=ada', '--dryRun'])).toEqual({ ownerId: 'ada', dryRun: true });
  });
});
