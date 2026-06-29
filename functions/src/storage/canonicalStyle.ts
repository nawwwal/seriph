import { WEIGHT_TOKENS, snapWeight, weightNameFromNumber } from "./canonicalizeData";
import { familySlug } from "./canonicalFamily";
import { normalizeStyleName } from "./canonicalText";

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

export function canonicalFaceId(styleName: string, isVariable: boolean): string {
  let normalized = normalizeStyleName(styleName);
  if (isVariable) {
    normalized = normalized.replace(/\bVariable\b/gi, "").replace(/\bRegular\b/gi, "").trim();
    return normalized ? `vf-${familySlug(normalized)}` : "vf";
  }
  return familySlug(normalized) || "regular";
}

export function staticStyleSuffix(weight: number, italic: boolean): string {
  const name = weightNameFromNumber(weight);
  if (weight === 400) return italic ? "Italic" : "Regular";
  return italic ? `${name}Italic` : name;
}
