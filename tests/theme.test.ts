import { describe, expect, it } from 'vitest';
import { themeOptions, isThemeName } from '@/lib/theme/themes';

const originalThemes = [
  'ink', 'noir', 'sunset', 'ocean', 'moss', 'volt', 'lilac', 'copper',
  'rose', 'shake', 'bodega', 'sanctuary', 'baguette', 'cathedral',
] as const;

const archiveThemes = [
  'phosphor', 'slate', 'flare', 'abyss', 'grove', 'acid', 'orchid',
] as const;

describe('themeOptions', () => {
  it('keeps every original Seriph press', () => {
    const values = themeOptions.map((theme) => theme.value);
    for (const theme of originalThemes) expect(values).toContain(theme);
  });

  it('adds Variant archive presses without replacing originals', () => {
    const values = themeOptions.map((theme) => theme.value);
    expect(values).toEqual([...originalThemes, ...archiveThemes]);
    expect(values).toHaveLength(21);
  });

  it('validates only declared theme names', () => {
    expect(isThemeName('ink')).toBe(true);
    expect(isThemeName('phosphor')).toBe(true);
    expect(isThemeName('orchid')).toBe(true);
    expect(isThemeName('bronze')).toBe(false);
    expect(isThemeName('cloister')).toBe(false);
  });
});
