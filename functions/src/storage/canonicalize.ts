/**
 * Canonicalization to the Google Fonts model.
 *
 * Mirrors the naming/structure rules Google Fonts uses so every uploaded face
 * lands in a predictable family/weight/style/variable layout:
 *  - weights map to the GF name<->number table (Thin 100 .. ExtraBlack 1000)
 *  - static files:   Family-<Weight>[Italic].<ext>   (Regular/Italic special-cased)
 *  - variable files: Family[axes].<ext> / Family-Italic[axes].<ext>
 *      axes alphabetical, custom (UPPERCASE) axes first, `wght` always last
 *
 * Refs: googlefonts.github.io/gf-guide/variable.html, .../metadata.html
 */

/** Canonical Google Fonts weight name <-> usWeightClass number. */
export const GF_WEIGHTS: ReadonlyArray<{ name: string; value: number }> = [
  { name: 'Thin', value: 100 },
  { name: 'ExtraLight', value: 200 },
  { name: 'Light', value: 300 },
  { name: 'Regular', value: 400 },
  { name: 'Medium', value: 500 },
  { name: 'SemiBold', value: 600 },
  { name: 'Bold', value: 700 },
  { name: 'ExtraBold', value: 800 },
  { name: 'Black', value: 900 },
  { name: 'ExtraBlack', value: 1000 },
];

/** OpenType registered axis tags (lowercase). Everything else is "custom". */
const REGISTERED_AXES = new Set(['ital', 'opsz', 'slnt', 'wdth', 'wght']);

/** Tokens (lowercased, de-spaced) used to recover a weight from a style string. */
const WEIGHT_TOKENS: ReadonlyArray<{ token: string; value: number }> = [
  { token: 'extrablack', value: 1000 },
  { token: 'ultrablack', value: 1000 },
  { token: 'extrabold', value: 800 },
  { token: 'ultrabold', value: 800 },
  { token: 'semibold', value: 600 },
  { token: 'demibold', value: 600 },
  { token: 'extralight', value: 200 },
  { token: 'ultralight', value: 200 },
  { token: 'thin', value: 100 },
  { token: 'hairline', value: 100 },
  { token: 'light', value: 300 },
  { token: 'medium', value: 500 },
  { token: 'black', value: 900 },
  { token: 'heavy', value: 900 },
  { token: 'bold', value: 700 },
  { token: 'regular', value: 400 },
  { token: 'normal', value: 400 },
  { token: 'book', value: 400 },
];

/** Snap an arbitrary usWeightClass to the nearest canonical GF weight. */
export function snapWeight(value: number): number {
  let best = GF_WEIGHTS[0]!;
  for (const w of GF_WEIGHTS) {
    if (Math.abs(w.value - value) < Math.abs(best.value - value)) best = w;
  }
  return best.value;
}

export function weightNameFromNumber(value: number): string {
  const exact = GF_WEIGHTS.find((w) => w.value === value);
  return (exact ?? GF_WEIGHTS.find((w) => w.value === snapWeight(value))!).name;
}

/**
 * Resolve a canonical weight + italic flag from a subfamily/style string,
 * falling back to the OS/2 usWeightClass when the name is unhelpful.
 */
export function parseStyle(
  subfamily: string | undefined,
  os2Weight?: number
): { weight: number; weightName: string; italic: boolean } {
  const raw = (subfamily ?? '').toLowerCase();
  const compact = raw.replace(/[\s_-]+/g, '');
  const italic = /italic|oblique/.test(raw);

  let weight: number | undefined;
  for (const { token, value } of WEIGHT_TOKENS) {
    if (compact.includes(token)) {
      weight = value;
      break;
    }
  }
  if (weight === undefined) {
    weight = typeof os2Weight === 'number' && os2Weight > 0 ? snapWeight(os2Weight) : 400;
  }
  return { weight, weightName: weightNameFromNumber(weight), italic };
}

/** Family slug for directories/ids: lowercase, hyphenated. ("IBM Plex" -> "ibm-plex"). */
export function familySlug(name: string): string {
  return (name || 'unknown')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}

/** Family token used in filenames: spaces/punctuation stripped, case preserved. ("IBM Plex Sans" -> "IBMPlexSans"). */
export function familyFileBase(name: string): string {
  return (name || 'Unknown').replace(/[^A-Za-z0-9]/g, '') || 'Unknown';
}

/** GF static style suffix: Regular/Italic special-cased, else <Weight>[Italic]. */
export function staticStyleSuffix(weight: number, italic: boolean): string {
  const name = weightNameFromNumber(weight);
  if (weight === 400) return italic ? 'Italic' : 'Regular';
  return italic ? `${name}Italic` : name;
}

/** Order axes the GF way: custom (UPPERCASE) alphabetical first, then registered alphabetical, `wght` last. */
export function orderAxisTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const unique = tags.filter((t) => (seen.has(t) ? false : (seen.add(t), true)));
  const custom = unique.filter((t) => !REGISTERED_AXES.has(t)).sort();
  const registered = unique
    .filter((t) => REGISTERED_AXES.has(t))
    .sort()
    .sort((a, b) => (a === 'wght' ? 1 : b === 'wght' ? -1 : 0));
  return [...custom, ...registered];
}

/**
 * Canonical filename for a face.
 * @param familyName human family name
 * @param opts.variable when true emits Family[axes]; axisTags required
 * @param ext extension without dot, e.g. "woff2" | "ttf"
 */
export function canonicalFilename(
  familyName: string,
  opts: {
    variable: boolean;
    italic: boolean;
    weight?: number;
    axisTags?: string[];
  },
  ext: string
): string {
  const base = familyFileBase(familyName);
  if (opts.variable) {
    const axes = orderAxisTags(opts.axisTags ?? []);
    const axisPart = axes.length ? `[${axes.join(',')}]` : '';
    const italicPart = opts.italic ? '-Italic' : '';
    return `${base}${italicPart}${axisPart}.${ext}`;
  }
  return `${base}-${staticStyleSuffix(opts.weight ?? 400, opts.italic)}.${ext}`;
}

/** GF primary category from a loose classification string. */
export type GfCategory = 'SERIF' | 'SANS_SERIF' | 'DISPLAY' | 'HANDWRITING' | 'MONOSPACE';
export function gfCategory(classification?: string, isMonospace?: boolean): GfCategory {
  if (isMonospace) return 'MONOSPACE';
  const c = (classification ?? '').toLowerCase();
  if (c.includes('mono')) return 'MONOSPACE';
  if (c.includes('script') || c.includes('hand')) return 'HANDWRITING';
  if (c.includes('display') || c.includes('decorative')) return 'DISPLAY';
  if (c.includes('sans')) return 'SANS_SERIF';
  if (c.includes('serif')) return 'SERIF';
  return 'SANS_SERIF';
}
