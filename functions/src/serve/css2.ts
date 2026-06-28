/**
 * Google-Fonts-style CSS API: GET /css2?family=<spec>[&family=...][&display=]
 *
 * Returns @font-face rules pointing at the Seriph CDN woff2 artifacts, so any
 * app or agent can drop in a Seriph font with one <link>. This module holds the
 * pure parse/generate logic; the HTTP handler (and Firestore lookup) wraps it.
 *
 * Supported spec grammar (subset of Google's):
 *   Family
 *   Family:wght@400
 *   Family:wght@400;700
 *   Family:wght@400..700            (variable range)
 *   Family:ital,wght@0,400;1,700    (0=normal, 1=italic)
 *   Family:ital@1
 */
import { familySlug } from '../storage/canonicalize';
import type { FontFamilyDoc, FontFace } from '../models/catalog.models';

export interface RequestedStyle {
  italic: boolean;
  /** A single weight, or a [min,max] range for variable requests. */
  weight: number | [number, number];
}

export interface FamilyRequest {
  family: string;
  slug: string;
  styles: RequestedStyle[];
}

const DEFAULT_DISPLAY = 'swap';
const VALID_DISPLAY = new Set(['auto', 'block', 'swap', 'fallback', 'optional']);

/** Parse a single `family=` spec value into a FamilyRequest. */
export function parseFamilySpec(spec: string): FamilyRequest {
  const [familyRaw, axisSpec] = spec.split(':');
  const family = familyRaw.replace(/\+/g, ' ').trim();
  const base: FamilyRequest = { family, slug: familySlug(family), styles: [] };

  if (!axisSpec) {
    base.styles.push({ italic: false, weight: 400 });
    return base;
  }

  const [axisPart, tuplePart] = axisSpec.split('@');
  const axes = axisPart.split(',').map((a) => a.trim()); // e.g. ["ital","wght"]
  const hasItal = axes.includes('ital');
  const wghtIdx = axes.indexOf('wght');
  const italIdx = axes.indexOf('ital');

  const tuples = (tuplePart ?? '400').split(';').map((t) => t.trim()).filter(Boolean);
  for (const tuple of tuples) {
    const parts = tuple.split(',').map((p) => p.trim());
    const italic = hasItal ? parts[italIdx] === '1' : false;
    const wghtToken = wghtIdx >= 0 ? parts[wghtIdx] : parts[parts.length - 1];

    let weight: number | [number, number] = 400;
    if (wghtToken && wghtToken.includes('..')) {
      const [lo, hi] = wghtToken.split('..').map((n) => parseInt(n, 10));
      weight = [lo, hi];
    } else if (wghtToken) {
      weight = parseInt(wghtToken, 10) || 400;
    }
    base.styles.push({ italic, weight });
  }
  if (base.styles.length === 0) base.styles.push({ italic: false, weight: 400 });
  return base;
}

/** Parse a full css2 query (already-decoded params) into family requests. */
export function parseCss2Query(params: URLSearchParams): {
  families: FamilyRequest[];
  display: string;
} {
  const families = params.getAll('family').map(parseFamilySpec);
  const displayRaw = params.get('display') ?? DEFAULT_DISPLAY;
  const display = VALID_DISPLAY.has(displayRaw) ? displayRaw : DEFAULT_DISPLAY;
  return { families, display };
}

/** Pick the face that best satisfies a requested style. */
export function resolveFace(family: FontFamilyDoc, style: RequestedStyle): FontFace | undefined {
  const variable = family.faces.find((f) => f.isVariable && f.italic === style.italic);
  if (Array.isArray(style.weight)) return variable;
  if (variable) return variable; // a variable face covers any requested weight
  // static: exact italic + weight, else nearest weight with matching italic
  const candidates = family.faces.filter((f) => f.italic === style.italic);
  if (candidates.length === 0) return undefined;
  return candidates.reduce((best, f) =>
    Math.abs(f.weight - (style.weight as number)) < Math.abs(best.weight - (style.weight as number)) ? f : best
  );
}

function faceWeightExpr(face: FontFace, style: RequestedStyle): string {
  if (face.isVariable && face.axes) {
    const wght = face.axes.find((a) => a.tag === 'wght');
    if (wght) return `${wght.min} ${wght.max}`;
  }
  if (Array.isArray(style.weight)) return `${style.weight[0]} ${style.weight[1]}`;
  return String(face.weight);
}

/** Build one @font-face rule. */
export function renderFontFace(
  familyName: string,
  face: FontFace,
  style: RequestedStyle,
  display: string
): string {
  const fontStyle = face.italic ? 'italic' : 'normal';
  return [
    '@font-face {',
    `  font-family: '${familyName}';`,
    `  font-style: ${fontStyle};`,
    `  font-weight: ${faceWeightExpr(face, style)};`,
    `  font-display: ${display};`,
    `  src: url(${face.woff2.url}) format('woff2');`,
    '}',
  ].join('\n');
}

/**
 * Build the full CSS body for a set of requests.
 * @param resolveFamily returns the family doc for a slug (or undefined if unknown).
 */
export function buildCss2(
  requests: FamilyRequest[],
  display: string,
  resolveFamily: (slug: string) => FontFamilyDoc | undefined
): string {
  const blocks: string[] = [];
  const emitted = new Set<string>();
  for (const req of requests) {
    const family = resolveFamily(req.slug);
    if (!family) continue;
    for (const style of req.styles) {
      const face = resolveFace(family, style);
      if (!face) continue;
      const key = `${family.slug}|${face.id}|${Array.isArray(style.weight) ? style.weight.join('-') : style.weight}`;
      if (emitted.has(key)) continue;
      emitted.add(key);
      blocks.push(renderFontFace(family.name, face, style, display));
    }
  }
  return blocks.join('\n');
}
