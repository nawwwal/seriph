import { describe, expect, it } from 'vitest';
import { normalizeName } from '@/utils/normalize';

describe('normalizeName', () => {
  it('lowercases and replaces whitespace with hyphens', () => {
    expect(normalizeName('Hello World Font')).toBe('hello-world-font');
  });

  it('strips non-alphanumeric characters except hyphen', () => {
    expect(normalizeName('~Fancy_Font!@#')).toBe('fancyfont');
  });

  it('collapses multiple hyphens and trims edges', () => {
    expect(normalizeName('  --Fancy   Font--  ')).toBe('fancy-font');
  });

  it('returns "unknown" for empty input', () => {
    expect(normalizeName('')).toBe('unknown');
  });
});
