import { describe, expect, it } from 'vitest';
import { parseSearchIndexRevision } from '@/lib/search/searchIndexRevision';

describe('parseSearchIndexRevision', () => {
  it('accepts a non-negative integer revision and rejects absent or malformed values', () => {
    expect(parseSearchIndexRevision('4')).toBe(4);
    expect(parseSearchIndexRevision(null)).toBeUndefined();
    expect(parseSearchIndexRevision('4.5')).toBeUndefined();
    expect(parseSearchIndexRevision('-1')).toBeUndefined();
    expect(parseSearchIndexRevision('revision-four')).toBeUndefined();
  });
});
