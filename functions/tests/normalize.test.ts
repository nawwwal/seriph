import { describe, expect, it } from 'vitest';
import { normalizeName } from '@/utils/normalize';

describe('functions normalizeName', () => {
  it('normalizes whitespace and casing', () => {
    expect(normalizeName('Functions Font Name')).toBe('functions-font-name');
  });

  it('handles falsy values', () => {
    expect(normalizeName('')).toBe('unknown');
  });
});
