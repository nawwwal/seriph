/**
 * Google-Fonts-style CSS API generation: turn parsed family requests into
 * @font-face rules pointing at the Seriph CDN woff2 artifacts. Parsing lives in
 * ./css2Parse; the HTTP handler (and Firestore lookup) wraps these in handlers.ts.
 */
import type { FontFamilyDoc, FontFace } from "../models/catalog.models";
import type { RequestedStyle, FamilyRequest } from "./css2Parse";

export type { RequestedStyle, FamilyRequest } from "./css2Parse";
export { parseFamilySpec, parseCss2Query } from "./css2Parse";

/** Pick the face that best satisfies a requested style. */
export function resolveFace(family: FontFamilyDoc, style: RequestedStyle): FontFace | undefined {
  const variable = family.faces.find((f) => f.isVariable && f.italic === style.italic);
  if (Array.isArray(style.weight)) return variable;
  if (variable) return variable; // a variable face covers any requested weight
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
  return [
    "@font-face {",
    `  font-family: '${familyName}';`,
    `  font-style: ${face.italic ? "italic" : "normal"};`,
    `  font-weight: ${faceWeightExpr(face, style)};`,
    `  font-display: ${display};`,
    `  src: url(${face.woff2.url}) format('woff2');`,
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
      const key = `${family.slug}|${face.id}|${Array.isArray(style.weight) ? style.weight.join("-") : style.weight}`;
      if (emitted.has(key)) continue;
      emitted.add(key);
      blocks.push(renderFontFace(family.name, face, style, display));
    }
  }
  return blocks.join("\n");
}
