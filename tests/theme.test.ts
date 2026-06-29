import { describe, expect, it } from 'vitest';
import { themeOptions, isThemeName } from '@/lib/theme/themes';

describe('themeOptions', () => {
  it('keeps the existing four themes and adds mymind-inspired choices', () => {
    expect(themeOptions.map((theme) => theme.value)).toEqual([
      'ink',
      'noir',
      'sunset',
      'ocean',
      'moss',
      'volt',
      'lilac',
      'copper',
      'rose',
      'shake',
      'bodega',
      'sanctuary',
      'baguette',
      'cathedral',
    ]);
  });

  it('validates only declared theme names', () => {
    expect(isThemeName('ink')).toBe(true);
    expect(isThemeName('cathedral')).toBe(true);
    expect(isThemeName('blue')).toBe(false);
  });
});
