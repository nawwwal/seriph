/**
 * Google-Fonts-style CSS API generation: turn parsed family requests into
 * @font-face rules pointing at the Seriph CDN woff2 artifacts.
 */
import type { FontFamilyDoc, FontFace } from "../models/catalog.models";
import type { RequestedStyle, FamilyRequest } from "./css2Parse";

export type { RequestedStyle, FamilyRequest } from "./css2Parse";
export { parseFamilySpec, parseCss2Query } from "./css2Parse";

function escapeCss(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function hasItalicAxis(face: FontFace): boolean {
  return Boolean(face.isVariable && face.axes?.some((a) => a.tag === "ital" || a.tag === "slnt"));
}

/** Pick the face that best satisfies a requested style. */
export function resolveFace(family: FontFamilyDoc, style: RequestedStyle): FontFace | undefined {
  const exactVariable = family.faces.find((f) => f.isVariable && f.italic === style.italic);
  if (exactVariable) return exactVariable;
  const dynamicVariable = family.faces.find((f) => hasItalicAxis(f));
  if (dynamicVariable) return dynamicVariable;
  if (Array.isArray(style.weight)) return family.faces.find((f) => f.isVariable);
  const candidates = family.faces.filter((f) => f.italic === style.italic);
  if (candidates.length === 0) return undefined;
  return candidates.reduce((best, f) =>
    Math.abs(f.weight - (style.weight as number)) < Math.abs(best.weight - (style.weight as number)) ? f : best
  );
}

function faceWeightExpr(face: FontFace, style: RequestedStyle): string {
  if (face.isVariable && face.axes) {
    const wght = face.axes.find((a) => a.tag === "wght");
    if (wght) return `${wght.min} ${wght.max}`;
  }
  if (Array.isArray(style.weight)) return `${style.weight[0]} ${style.weight[1]}`;
  return String(face.weight);
}

/** Build one @font-face rule. */
export function renderFontFace(familyName: string, face: FontFace, style: RequestedStyle, display: string): string {
  const fontStyle = hasItalicAxis(face) ? (style.italic ? "italic" : "normal") : (face.italic ? "italic" : "normal");
  return [
    "@font-face {",
    `  font-family: '${escapeCss(familyName)}';`,
    `  font-style: ${fontStyle};`,
    `  font-weight: ${faceWeightExpr(face, style)};`,
    `  font-display: ${display};`,
    `  src: url('${escapeCss(face.woff2.url)}') format('woff2');`,
    "}",
  ].join("\n");
}

/** Build the full CSS body for a set of requests. */
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
      const key = `${family.slug}|${face.id}|${style.italic ? 1 : 0}|${Array.isArray(style.weight) ? style.weight.join("-") : style.weight}`;
      if (emitted.has(key)) continue;
      emitted.add(key);
      blocks.push(renderFontFace(family.name, face, style, display));
    }
  }
  return blocks.join("\n");
}
