import { describe, expect, it } from 'vitest';
import { mapImportBatch, mapImportBatchChildren } from '@/lib/imports/mapImportBatch';

describe('browser-facing import DTO mapping', () => {
  it('strips source, storage, and private paths from batches and nested phases', () => {
    const mapped = mapImportBatch({ batchId: 'b1', ownerId: 'u1', label: 'Import', expectedSourceCount: 1, outcome: 'active', counters: { families: 1 }, phases: { upload: { state: 'done', sourcePath: '/private/source.otf', nested: { storagePath: 'gs://secret' } } } });
    expect(mapped).toMatchObject({ batchId: 'b1', phases: { upload: { state: 'done', nested: {} } } });
    expect(JSON.stringify(mapped)).not.toMatch(/sourcePath|storagePath|private|secret|\.otf/);
  });

  it('strips private fields from family-plan and review-item DTOs', () => {
    const mapped = mapImportBatchChildren({ batch: null, familyPlans: [{ id: 'f1', familyName: 'Sans', relativePath: 'private/fonts', storagePath: 'gs://secret', nested: { fileUrl: 'https://private' } }], reviewItems: [{ id: 'r1', reason: 'duplicate', sourcePath: '/tmp/font.otf', privateStorageUrl: 'https://secret' }] });
    expect(mapped).toMatchObject({ familyPlans: [{ id: 'f1', familyName: 'Sans', nested: {} }], reviewItems: [{ id: 'r1', reason: 'duplicate' }] });
    expect(JSON.stringify(mapped)).not.toMatch(/relativePath|storagePath|sourcePath|privateStorageUrl|https|\/tmp/);
  });
});
