import { describe, expect, it } from 'vitest';
import { canonicalFamilyDocId } from '@/lib/server/catalogFamilyIdentity';

describe('catalog family identity', () => {
  it('derives the owner-scoped document id from a public family slug', () => {
    expect(canonicalFamilyDocId('user-1', 'abc-ginto-nord')).toBe('user-1__abc-ginto-nord');
  });
});
