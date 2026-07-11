import { describe, expect, it } from 'vitest';
import { parseMergeArgs } from '../../src/scripts/mergeSplitFamilies';

describe('parseMergeArgs', () => {
  it('parses safe apply and batching flags', () => {
    expect(parseMergeArgs([
      '--apply',
      '--skipConflicts',
      '--reparseOriginals',
      '--reparseConcurrency=4',
      '--batchWrites=25',
    ])).toMatchObject({
      apply: true,
      skipConflicts: true,
      reparseOriginals: true,
      reparseConcurrency: 4,
      batchWrites: 25,
    });
  });
});
