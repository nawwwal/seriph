import { describe, expect, it } from 'vitest';
import { themeMetaFor, themeMetaList } from '@/lib/theme/themeMeta';
import { themeOptions } from '@/lib/theme/themes';

describe('themeMeta', () => {
  it('covers every registered theme', () => {
    expect(themeMetaList).toHaveLength(themeOptions.length);
    expect(themeMetaFor('ink').label).toBe('Ink');
    expect(themeMetaFor('ink').edition).toBe('01');
  });
});
