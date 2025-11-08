import { describe, it, expect } from 'vitest';
import { normalizeName } from '../../../src/utils/normalize';

describe('normalizeName', () => {
  it('normalizes names consistently (case, punctuation, spacing)', () => {
    expect(normalizeName('  Helvetica  Neue™  ')).toBe('helvetica-neue');
    expect(normalizeName('Times—New—Roman')).toBe('timesnewroman');
  });
});


