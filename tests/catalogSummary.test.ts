import { describe, expect, it } from 'vitest';
import { summarizeCatalogFamilies } from '@/lib/server/catalogSummary';

describe('catalog summary', () => {
  it('counts visible families and chooses the newest created family', () => {
    const summary = summarizeCatalogFamilies([
      { name: 'Aster', styleCount: 4, createdAt: '2026-07-01T10:00:00.000Z', hidden: false },
      { name: 'Benton', faces: [{}, {}], createdAt: '2026-07-03T10:00:00.000Z', hidden: false },
      { name: 'Merged', styleCount: 9, createdAt: '2026-07-04T10:00:00.000Z', hidden: true },
    ], '2026-07-10T10:00:00.000Z');

    expect(summary).toEqual({
      familyCount: 2,
      styleCount: 6,
      recentFamilyName: 'Benton',
      generatedAt: '2026-07-10T10:00:00.000Z',
      libraryRevision: 1,
      updatedAt: '2026-07-10T10:00:00.000Z',
    });
  });
});
