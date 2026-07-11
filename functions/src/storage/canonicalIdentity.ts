import { familyFileBase, familySlug } from "./canonicalFamily";
import { cleanName, isRegularStyle, normalizeStyleName, splitStyleWords } from "./canonicalText";
import { combineStyleNames, splitTrailingStyleSuffix, stripFamilyCutPrefix } from "./canonicalStyleSuffix";

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

function postScriptStyle(postScriptName: string | undefined): string | undefined {
  const suffix = postScriptName?.split("-").pop();
  return suffix ? splitStyleWords(suffix) : undefined;
}

function stripVariableTail(familyName: string): string | undefined {
  const stripped = familyName.replace(/(?:\s|-|_)+(variable|vf)$/i, "").trim();
  return stripped && stripped !== familyName ? stripped : undefined;
}

function bestStyleCandidate(familyName: string, candidates: Array<string | undefined>): string | undefined {
  const styles = candidates
    .map((candidate) => stripFamilyCutPrefix(candidate, familyName))
    .filter((candidate): candidate is string => Boolean(candidate));
  return styles.find((candidate) => !isRegularStyle(candidate)) ?? styles[0];
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
  let familyStyle: string | undefined;
  const canRepairFamilyName = !preferredFamily;

  if (!familyName && input.isVariable) {
    const variableFamily = stripVariableTail(rawFamily);
    if (variableFamily) {
      familyName = variableFamily;
      styleName = "Variable";
    }
  }

  if (!familyName) {
    familyName = rawFamily;
  }

  if (canRepairFamilyName) {
    const repaired = splitTrailingStyleSuffix(familyName);
    familyName = repaired.familyName;
    familyStyle = repaired.styleName;
  }
  const styleCandidates = preferredSubfamily ? [preferredSubfamily] : [styleName, subfamily, psStyle];
  const strippedStyle = bestStyleCandidate(familyName, styleCandidates);
  styleName = combineStyleNames(familyStyle, strippedStyle);
  if (input.isVariable && !/\bvariable\b/i.test(styleName)) styleName = `${styleName === "Regular" ? "" : `${styleName} `}Variable`.trim();
  return { familyName, styleName, slug: familySlug(familyName), fileBase: familyFileBase(familyName) };
}
