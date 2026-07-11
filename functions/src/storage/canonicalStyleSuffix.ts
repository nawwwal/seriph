import { cleanName, isRegularStyle, normalizeStyleName, splitStyleWords } from "./canonicalText";

interface StyleRepair {
  familyName: string;
  styleName?: string;
}

const STYLE_WEIGHT_TOKENS = [
  "Extra Black", "Ultra Black", "Extra Bold", "Ultra Bold", "Semi Bold", "Demi Bold",
  "Extra Light", "Ultra Light", "Hairline", "Thin", "Air", "Light", "Medium",
  "Black", "Heavy", "Bold",
].map((token) => splitStyleWords(token).split(" ").filter(Boolean));
const SLOPE_TOKENS = ["Italic", "Oblique"];
const VARIABLE_TOKENS = ["Variable", "VF"];

function words(value: string): string[] {
  return splitStyleWords(value).split(" ").filter(Boolean);
}

function sameWord(left: string, right: string): boolean {
  return left.localeCompare(right, undefined, { sensitivity: "accent" }) === 0;
}

function endsWithPattern(source: string[], pattern: string[]): boolean {
  if (pattern.length > source.length) return false;
  return pattern.every((part, index) => sameWord(source[source.length - pattern.length + index]!, part));
}

function popPattern(source: string[], patterns: string[]): string[] | null {
  const sorted = [...patterns].sort((a, b) => words(b).length - words(a).length);
  for (const pattern of sorted) {
    const patternWords = words(pattern);
    if (!endsWithPattern(source, patternWords)) continue;
    source.splice(source.length - patternWords.length, patternWords.length);
    return patternWords;
  }
  return null;
}

function popWeightPattern(source: string[]): string[] | null {
  const sorted = [...STYLE_WEIGHT_TOKENS].sort((a, b) => b.length - a.length);
  for (const pattern of sorted) {
    if (!endsWithPattern(source, pattern)) continue;
    const actual = source.slice(source.length - pattern.length);
    source.splice(source.length - pattern.length, pattern.length);
    return actual;
  }
  return null;
}

export function splitTrailingStyleSuffix(familyName: string): StyleRepair {
  const source = words(familyName);
  const style: string[] = [];
  const slope = popPattern(source, [...SLOPE_TOKENS, ...VARIABLE_TOKENS]);
  if (slope) style.unshift(...slope);
  const weight = popWeightPattern(source);
  if (weight) style.unshift(...weight);
  if (style.length === 0 || source.length === 0) return { familyName };
  return { familyName: source.join(" "), styleName: normalizeStyleName(style.join(" ")) };
}

export function stripFamilyCutPrefix(styleName: string | undefined, familyName: string): string | undefined {
  const cleaned = cleanName(styleName);
  if (!cleaned) return undefined;
  const style = words(cleaned);
  const family = words(familyName);
  const max = Math.min(style.length - 1, family.length);
  for (let length = max; length > 0; length -= 1) {
    const familyTail = family.slice(family.length - length);
    const styleHead = style.slice(0, length);
    if (!familyTail.every((part, index) => sameWord(part, styleHead[index]!))) continue;
    return normalizeStyleName(style.slice(length).join(" "));
  }
  return normalizeStyleName(cleaned);
}

function hasItalicOrVariable(styleName: string): boolean {
  return /\b(Italic|Oblique|Variable|VF)\b/i.test(styleName);
}

function styleModifierOnly(styleName: string): string {
  const withoutRegular = styleName.replace(/\bRegular\b/gi, "").replace(/\s+/g, " ").trim();
  return withoutRegular || styleName;
}

export function combineStyleNames(primary: string | undefined, secondary: string | undefined): string {
  const first = normalizeStyleName(primary);
  const second = normalizeStyleName(secondary);
  if (isRegularStyle(first)) return second;
  if (isRegularStyle(second)) return first;
  const compactFirst = first.toLowerCase().replace(/\s+/g, "");
  const compactSecond = second.toLowerCase().replace(/\s+/g, "");
  if (compactSecond.includes(compactFirst)) return second;
  if (hasItalicOrVariable(second) && !hasItalicOrVariable(first)) return normalizeStyleName(`${first} ${styleModifierOnly(second)}`);
  return first;
}
