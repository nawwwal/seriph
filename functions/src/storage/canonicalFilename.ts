import { REGISTERED_AXES } from "./canonicalizeData";
import { familyFileBase } from "./canonicalFamily";
import { cleanName, compactStyleSuffix, normalizeStyleName } from "./canonicalText";
import { staticStyleSuffix } from "./canonicalStyle";

function staticStyleSuffixFromName(styleName: string | undefined, weight: number, italic: boolean): string {
  if (!cleanName(styleName)) return staticStyleSuffix(weight, italic);
  const normalized = normalizeStyleName(styleName);
  if (normalized === "Regular") return "Regular";
  if (normalized === "Regular Italic") return "Italic";
  if (normalized) return compactStyleSuffix(normalized);
  return staticStyleSuffix(weight, italic);
}

function variableStyleSuffix(styleName: string | undefined, italic: boolean): string {
  if (!cleanName(styleName)) return italic ? "-Italic" : "";
  const normalized = normalizeStyleName(styleName)
    .replace(/\bVariable\b/gi, "")
    .replace(/\bRegular\b/gi, "")
    .replace(italic ? /\bItalic\b/gi : /$^/, "")
    .trim();
  const descriptor = compactStyleSuffix(normalized);
  if (descriptor) return `-${descriptor}${italic ? "Italic" : ""}`;
  return italic ? "-Italic" : "";
}

export function orderAxisTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const unique = tags.filter((tag) => (seen.has(tag) ? false : (seen.add(tag), true)));
  const custom = unique.filter((tag) => !REGISTERED_AXES.has(tag)).sort();
  const registered = unique
    .filter((tag) => REGISTERED_AXES.has(tag))
    .sort()
    .sort((a, b) => (a === "wght" ? 1 : b === "wght" ? -1 : 0));
  return [...custom, ...registered];
}

export function canonicalFilename(
  familyName: string,
  opts: { variable: boolean; italic: boolean; weight?: number; axisTags?: string[]; styleName?: string },
  ext: string
): string {
  const base = familyFileBase(familyName);
  if (opts.variable) {
    const axes = orderAxisTags(opts.axisTags ?? []);
    const axisPart = axes.length ? `[${axes.join(",")}]` : "";
    return `${base}${variableStyleSuffix(opts.styleName, opts.italic)}${axisPart}.${ext}`;
  }
  return `${base}-${staticStyleSuffixFromName(opts.styleName, opts.weight ?? 400, opts.italic)}.${ext}`;
}
