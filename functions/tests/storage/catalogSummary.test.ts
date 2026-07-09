import { describe, expect, it } from 'vitest';
import { summarizeCatalogFamilyRecords } from '../../src/storage/catalogSummary';

describe('catalog summary storage', () => {
  it('excludes hidden aliases from the persisted browse summary', () => {
    expect(summarizeCatalogFamilyRecords([
      { name: 'Aster', styleCount: 3, hidden: false, createdAt: '2026-07-01T10:00:00.000Z' },
      { name: 'Alias', styleCount: 3, hidden: true, createdAt: '2026-07-02T10:00:00.000Z' },
    ], '2026-07-10T10:00:00.000Z', 7)).toEqual({
      familyCount: 1,
      styleCount: 3,
      recentFamilyName: 'Aster',
      generatedAt: '2026-07-10T10:00:00.000Z',
      updatedAt: '2026-07-10T10:00:00.000Z',
      libraryRevision: 7,
    });
  });
});
