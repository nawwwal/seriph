/** Escape a string for single-quoted CSS literals while stripping control characters. */
export function escapeCssString(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
}

/** Return a single-quoted, CSS-escaped font-family declaration value. */
export function quoteCssFontFamily(name: string): string {
  return `'${escapeCssString(name)}'`;
}

/** Map a font asset URL or fallback format string to a valid CSS @font-face format(). */
export function fontFormatFromUrl(url: string, fallbackFormat?: string): string {
  const path = url.split('?')[0]?.split('#')[0] ?? '';
  const basename = path.split('/').pop() ?? '';
  const dot = basename.lastIndexOf('.');
  const ext = dot >= 0 ? basename.slice(dot + 1).toLowerCase() : '';
  const normalized = ext || (fallbackFormat || '').toLowerCase();
  if (normalized === 'woff2') return 'woff2';
  if (normalized === 'woff') return 'woff';
  if (normalized === 'otf' || normalized === 'opentype') return 'opentype';
  if (normalized === 'ttf' || normalized === 'truetype') return 'truetype';
  if (normalized === 'eot' || normalized === 'embedded-opentype') return 'embedded-opentype';
  return 'woff2';
}
