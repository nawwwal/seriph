/**
 * Canonicalization to the Google Fonts model: predictable family/weight/style/
 * variable layout. Weight tables live in ./canonicalizeData.
 *  - static files:   Family-<Weight>[Italic].<ext>   (Regular/Italic special-cased)
 *  - variable files: Family[axes].<ext> / Family-Italic[axes].<ext>
 *      axes alphabetical, custom (UPPERCASE) axes first, `wght` always last
 * Refs: googlefonts.github.io/gf-guide/variable.html, .../metadata.html
 */
import { REGISTERED_AXES, WEIGHT_TOKENS, snapWeight, weightNameFromNumber } from "./canonicalizeData";

export { GF_WEIGHTS, snapWeight, weightNameFromNumber } from "./canonicalizeData";

/** Resolve a canonical weight + italic flag from a subfamily/style string,
 *  falling back to the OS/2 usWeightClass when the name is unhelpful. */
export function parseStyle(
  subfamily: string | undefined,
  os2Weight?: number
): { weight: number; weightName: string; italic: boolean } {
  const raw = (subfamily ?? "").toLowerCase();
  const compact = raw.replace(/[\s_-]+/g, "");
  const italic = /italic|oblique/.test(raw);

  let weight: number | undefined;
  for (const { token, value } of WEIGHT_TOKENS) {
    if (compact.includes(token)) {
      weight = value;
      break;
    }
  }
  if (weight === undefined) {
    weight = typeof os2Weight === "number" && os2Weight > 0 ? snapWeight(os2Weight) : 400;
  }
  return { weight, weightName: weightNameFromNumber(weight), italic };
}

/** Family slug for directories/ids: lowercase, hyphenated ("IBM Plex" -> "ibm-plex"). */
export function familySlug(name: string): string {
  return (
    (name || "unknown")
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "") || "unknown"
  );
}

/** Family token used in filenames: punctuation stripped, case preserved ("IBM Plex Sans" -> "IBMPlexSans"). */
export function familyFileBase(name: string): string {
  return (name || "Unknown").replace(/[^A-Za-z0-9]/g, "") || "Unknown";
}

/** GF static style suffix: Regular/Italic special-cased, else <Weight>[Italic]. */
export function staticStyleSuffix(weight: number, italic: boolean): string {
  const name = weightNameFromNumber(weight);
  if (weight === 400) return italic ? "Italic" : "Regular";
  return italic ? `${name}Italic` : name;
}

/** Order axes the GF way: custom (UPPERCASE) alphabetical first, registered next, `wght` last. */
export function orderAxisTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const unique = tags.filter((t) => (seen.has(t) ? false : (seen.add(t), true)));
  const custom = unique.filter((t) => !REGISTERED_AXES.has(t)).sort();
  const registered = unique
    .filter((t) => REGISTERED_AXES.has(t))
    .sort()
    .sort((a, b) => (a === "wght" ? 1 : b === "wght" ? -1 : 0));
  return [...custom, ...registered];
}

/** Canonical filename for a face. `ext` is without the dot, e.g. "woff2" | "ttf". */
export function canonicalFilename(
  familyName: string,
  opts: { variable: boolean; italic: boolean; weight?: number; axisTags?: string[] },
  ext: string
): string {
  const base = familyFileBase(familyName);
  if (opts.variable) {
    const axes = orderAxisTags(opts.axisTags ?? []);
    const axisPart = axes.length ? `[${axes.join(",")}]` : "";
    return `${base}${opts.italic ? "-Italic" : ""}${axisPart}.${ext}`;
  }
  return `${base}-${staticStyleSuffix(opts.weight ?? 400, opts.italic)}.${ext}`;
}

/** GF primary category from a loose classification string. */
export type GfCategory = "SERIF" | "SANS_SERIF" | "DISPLAY" | "HANDWRITING" | "MONOSPACE";
export function gfCategory(classification?: string, isMonospace?: boolean): GfCategory {
  if (isMonospace) return "MONOSPACE";
  const c = (classification ?? "").toLowerCase();
  if (c.includes("mono")) return "MONOSPACE";
  if (c.includes("script") || c.includes("hand")) return "HANDWRITING";
  if (c.includes("display") || c.includes("decorative")) return "DISPLAY";
  if (c.includes("sans")) return "SANS_SERIF";
  if (c.includes("serif")) return "SERIF";
  return "SANS_SERIF";
}
