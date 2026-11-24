import type { FontFamilyDoc } from "../../../models/catalog.models";

const GENERIC_TOKENS = new Set([
  "sans", "serif", "pro", "display", "text", "mono", "monospace", "condensed", "compressed",
  "extended", "expanded", "wide", "narrow", "neue", "new", "grotesk", "grotesque", "gothic",
  "slab", "script", "hand", "brush", "variable", "vf", "std", "lt", "mt", "bt", "ce", "cyr",
  "regular", "bold", "italic", "light", "medium", "black", "thin", "heavy", "book", "roman",
  "font", "type", "caption", "subhead", "headline", "micro", "title", "alt", "complete",
]);

const SUFFIX_RE = /\b(display|text|subhead|caption|headline|micro|title|pro|std|variable|vf|condensed|compressed|extended|expanded|wide|narrow|lt|mt|bt|ce|cyr|regular|bold|italic|oblique|light|medium|semibold|demibold|extrabold|black|thin|heavy|book|roman|complete)\b/gi;

export function meaningfulNameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !/^\d+$/.test(token) && !GENERIC_TOKENS.has(token))
    .slice(0, 10);
}

export function familyCoreStem(name: string): string {
  const cleaned = name.toLowerCase().replace(/[^a-z0-9\s]+/g, " ").replace(SUFFIX_RE, " ").replace(/\s+/g, " ").trim();
  return cleaned || name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function preferredFamilies(family: FontFamilyDoc): Set<string> {
  const set = new Set<string>();
  for (const face of family.faces ?? []) {
    const pref = face.meta?.preferredFamily;
    if (typeof pref === "string" && pref.trim()) set.add(pref.trim().toLowerCase());
  }
  return set;
}

export function deterministicSameFamily(source: FontFamilyDoc, candidate: FontFamilyDoc): boolean {
  const sourcePrefs = preferredFamilies(source);
  const candPrefs = preferredFamilies(candidate);
  for (const pref of sourcePrefs) {
    if (candPrefs.has(pref)) return true;
  }
  const stemA = familyCoreStem(source.name);
  const stemB = familyCoreStem(candidate.name);
  return stemA.length >= 3 && stemA === stemB && !GENERIC_TOKENS.has(stemA);
}
