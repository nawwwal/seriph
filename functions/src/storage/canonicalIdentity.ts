import { familyFileBase, familySlug } from "./canonicalFamily";
import { cleanName, isRegularStyle, normalizeStyleName, splitStyleWords } from "./canonicalText";

export interface CanonicalFontIdentityInput {
  familyName?: string;
  subfamilyName?: string;
  preferredFamily?: string;
  preferredSubfamily?: string;
  wwsFamilyName?: string;
  wwsSubfamilyName?: string;
  postScriptName?: string;
  fullName?: string;
  isVariable?: boolean;
}

export interface CanonicalFontIdentity {
  familyName: string;
  styleName: string;
  slug: string;
  fileBase: string;
}

function stripTrailingStyle(familyName: string, styleName: string | undefined): string | undefined {
  if (!styleName || isRegularStyle(styleName)) return undefined;
  const candidates = [
    splitStyleWords(styleName),
    splitStyleWords(styleName).replace(/\b(Italic|Oblique)\b/gi, "").replace(/\s+/g, " ").trim(),
  ].filter(Boolean);
  for (const candidate of candidates) {
    const pattern = new RegExp(`(?:\\s|-|_)+${candidate.replace(/\s+/g, "[\\s_-]*")}$`, "i");
    const stripped = familyName.replace(pattern, "").trim();
    if (stripped && stripped !== familyName) return stripped;
  }
  return undefined;
}

function postScriptStyle(postScriptName: string | undefined): string | undefined {
  const suffix = postScriptName?.split("-").pop();
  return suffix ? splitStyleWords(suffix) : undefined;
}

function stripVariableTail(familyName: string): string | undefined {
  const stripped = familyName.replace(/(?:\s|-|_)+(variable|vf)$/i, "").trim();
  return stripped && stripped !== familyName ? stripped : undefined;
}

export function resolveCanonicalFontIdentity(input: CanonicalFontIdentityInput): CanonicalFontIdentity {
  const rawFamily = cleanName(input.familyName) ?? "Unknown Family";
  const preferredFamily = cleanName(input.preferredFamily);
  const preferredSubfamily = cleanName(input.preferredSubfamily);
  const wwsFamily = cleanName(input.wwsFamilyName);
  const wwsSubfamily = cleanName(input.wwsSubfamilyName);
  const subfamily = cleanName(input.subfamilyName);
  const psStyle = postScriptStyle(input.postScriptName);
  let familyName = preferredFamily ?? (wwsFamily && !isRegularStyle(wwsSubfamily) ? wwsFamily : undefined);
  let styleName = preferredSubfamily ?? (!familyName && wwsFamily ? wwsSubfamily : undefined);

  if (!familyName && input.isVariable) {
    const variableFamily = stripVariableTail(rawFamily);
    if (variableFamily) {
      familyName = variableFamily;
      styleName = "Variable";
    }
  }

  if (!familyName) {
    const stripped = stripTrailingStyle(rawFamily, psStyle);
    if (stripped) {
      familyName = stripped;
      styleName = psStyle;
    }
  }

  familyName = familyName ?? rawFamily;
  styleName = normalizeStyleName(styleName ?? subfamily ?? psStyle);
  if (input.isVariable && !/\bvariable\b/i.test(styleName)) styleName = `${styleName === "Regular" ? "" : `${styleName} `}Variable`.trim();
  return { familyName, styleName, slug: familySlug(familyName), fileBase: familyFileBase(familyName) };
}
