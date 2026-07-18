import { familySlug } from "../../storage/canonicalFamily";
import { resolveCanonicalFontIdentity, type CanonicalFontIdentityInput } from "../../storage/canonicalIdentity";
import { parseStyle } from "../../storage/canonicalStyle";
import { normalizeIdentityKey, resolveLogicalFaceKey } from "./logicalFace";
import {
  resolveContainerFormat,
  resolveFontTechnology,
  type FontTechnology,
  type VariableAxisLike,
} from "./technology";

export interface PlannedFontInput extends CanonicalFontIdentityInput {
  filename?: string;
  extension?: string;
  format?: string;
  weight?: number;
  width?: number;
  italic?: boolean;
  slant?: number;
  opticalSize?: number | string;
  opticalCut?: string;
  variableAxes?: readonly VariableAxisLike[];
}

export interface PlannedFontIdentity {
  familyName: string;
  familyKey: string;
  familySlug: string;
  styleName: string;
  weight: number;
  width: number;
  italic: boolean;
  logicalFaceKey: string;
  containerFormat: ReturnType<typeof resolveContainerFormat>;
  technology: FontTechnology;
  reasons: string[];
}

function displayName(value: string | undefined): string | undefined {
  const normalized = value?.normalize("NFC").replace(/\s+/gu, " ").trim();
  return normalized || undefined;
}

function filenameStem(filename: string | undefined): string | undefined {
  const base = filename?.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "");
  return displayName(base);
}

function fallbackFamily(input: PlannedFontInput): { value: string; reason: string } {
  const choices: Array<[string | undefined, string]> = [
    [input.preferredFamily, "preferred-family"],
    [input.wwsFamilyName, "wws-family"],
    [input.familyName, "legacy-family"],
    [input.fullName, "full-name"],
    [input.postScriptName?.split("-")[0], "postscript-name"],
    [filenameStem(input.filename), "filename"],
  ];
  const found = choices.find(([value]) => displayName(value));
  return { value: displayName(found?.[0]) ?? "Unknown Family", reason: found?.[1] ?? "fallback-family" };
}

function fallbackStyle(input: PlannedFontInput): { value: string | undefined; reason: string | undefined } {
  const choices: Array<[string | undefined, string]> = [
    [input.preferredSubfamily, "preferred-style"],
    [input.wwsSubfamilyName, "wws-style"],
    [input.subfamilyName, "legacy-style"],
    [input.fullName, "full-name"],
    [input.postScriptName?.split("-").pop(), "postscript-style"],
    [filenameStem(input.filename), "filename-style"],
  ];
  const found = choices.find(([value]) => displayName(value));
  return { value: displayName(found?.[0]), reason: found?.[1] };
}

function widthValue(styleName: string, input: PlannedFontInput): number {
  if (typeof input.width === "number" && Number.isFinite(input.width)) return input.width;
  const axis = input.variableAxes?.find((item) => item.tag?.toLowerCase() === "wdth");
  const axisDefault = axis?.defaultValue ?? axis?.default;
  if (typeof axisDefault === "number" && Number.isFinite(axisDefault)) return axisDefault;
  if (/ultra\s*condensed/i.test(styleName)) return 50;
  if (/extra\s*condensed/i.test(styleName)) return 62.5;
  if (/semi\s*condensed/i.test(styleName)) return 87.5;
  if (/semi\s*expanded/i.test(styleName)) return 112.5;
  if (/extra\s*expanded/i.test(styleName)) return 125;
  if (/ultra\s*expanded/i.test(styleName)) return 200;
  if (/condensed|narrow/i.test(styleName)) return 75;
  if (/expanded|wide/i.test(styleName)) return 125;
  return 100;
}

function hasItalic(styleName: string, input: PlannedFontInput): boolean {
  if (typeof input.italic === "boolean") return input.italic;
  const axis = input.variableAxes?.find((item) => item.tag?.toLowerCase() === "ital");
  const axisDefault = axis?.defaultValue ?? axis?.default;
  return /italic|oblique/i.test(styleName) || (typeof axisDefault === "number" && axisDefault >= 0.5);
}

export function resolvePlannedFontIdentity(input: PlannedFontInput): PlannedFontIdentity {
  const family = fallbackFamily(input);
  const style = fallbackStyle(input);
  const canonicalInput: CanonicalFontIdentityInput = {
    ...input,
    familyName: family.value,
    subfamilyName: style.value,
    preferredFamily: displayName(input.preferredFamily),
    preferredSubfamily: displayName(input.preferredSubfamily),
    wwsFamilyName: displayName(input.wwsFamilyName),
    wwsSubfamilyName: displayName(input.wwsSubfamilyName),
    postScriptName: displayName(input.postScriptName),
    fullName: displayName(input.fullName),
    isVariable: Boolean(input.variableAxes?.length),
  };
  const canonical = resolveCanonicalFontIdentity(canonicalInput);
  const styleName = displayName(canonical.styleName) ?? "Regular";
  const parsedStyle = parseStyle(styleName, input.weight);
  const weight = input.weight ?? parsedStyle.weight;
  const width = widthValue(styleName, input);
  const italic = hasItalic(styleName, input);
  const technology = resolveFontTechnology(input);
  const logicalFaceKey = resolveLogicalFaceKey({
    styleName, weight, width, italic, slant: input.slant,
    opticalSize: input.opticalSize ?? input.opticalCut,
    variableAxes: input.variableAxes, postScriptName: input.postScriptName,
  });
  return {
    familyName: canonical.familyName.normalize("NFC"),
    familyKey: normalizeIdentityKey(canonical.familyName),
    familySlug: familySlug(canonical.familyName),
    styleName,
    weight,
    width,
    italic,
    logicalFaceKey,
    containerFormat: resolveContainerFormat(input),
    technology,
    reasons: [family.reason, style.reason ?? "default-style", technology === "Variable" ? "variation-axes" : "container-format"],
  };
}
