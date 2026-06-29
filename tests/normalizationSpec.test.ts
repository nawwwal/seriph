import { describe, expect, it } from 'vitest';
import { normalizeFamilyName } from '@/utils/normalizationSpec';

describe('normalizeFamilyName', () => {
  it('collapses weight/style suffixes while preserving cut names', () => {
    expect(normalizeFamilyName('ABC Ginto Nord Black')).toBe('abc-ginto-nord');
    expect(normalizeFamilyName('ABC Ginto Plus Variable')).toBe('abc-ginto-plus');
    expect(normalizeFamilyName('ABC Ginto Normal')).toBe('abc-ginto-normal');
  });
});
