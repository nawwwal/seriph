export const themeOptions = [
  // Original Seriph presses (unchanged)
  { value: 'ink', label: 'Ink' },
  { value: 'noir', label: 'Noir' },
  { value: 'sunset', label: 'Sunset' },
  { value: 'ocean', label: 'Ocean' },
  { value: 'moss', label: 'Moss' },
  { value: 'volt', label: 'Volt' },
  { value: 'lilac', label: 'Lilac' },
  { value: 'copper', label: 'Copper' },
  { value: 'rose', label: 'Rose' },
  { value: 'shake', label: 'Shake' },
  { value: 'bodega', label: 'Bodega' },
  { value: 'sanctuary', label: 'Sanctuary' },
  { value: 'baguette', label: 'Baguette' },
  { value: 'cathedral', label: 'Cathedral' },
  // Variant archive palettes (added, not replacements)
  { value: 'phosphor', label: 'Phosphor' },
  { value: 'slate', label: 'Slate' },
  { value: 'flare', label: 'Flare' },
  { value: 'abyss', label: 'Abyss' },
  { value: 'grove', label: 'Grove' },
  { value: 'acid', label: 'Acid' },
  { value: 'orchid', label: 'Orchid' },
] as const;

export type ThemeName = (typeof themeOptions)[number]['value'];

const themeValues: readonly string[] = themeOptions.map((theme) => theme.value);

export function isThemeName(value: string | null): value is ThemeName {
  return value !== null && themeValues.includes(value);
}
