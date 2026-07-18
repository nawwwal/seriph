import { cdnUrl } from "../config/catalogConfig";
import type { CanonicalAxis, FontFace } from "../models/catalog.models";
import type { FontFormat } from "./transcode";

/** Stable face id, e.g. "semibold", "bold-italic", or "vf"/"vf-italic". */
export function faceId(weightName: string, italic: boolean, isVariable: boolean): string {
  if (isVariable) return italic ? "vf-italic" : "vf";
  return `${weightName.toLowerCase()}${italic ? "-italic" : ""}`;
}

/** Assemble the FontFace document from parsed metadata and written asset paths. */
export function buildFace(params: {
  parsed: any;
  faceId?: string;
  styleName?: string;
  weight: number;
  weightName: string;
  width: number;
  italic: boolean;
  isVariable: boolean;
  axes?: CanonicalAxis[];
  format: FontFormat;
  fileSize: number;
  servedFilename: string;
  servedStoragePath: string;
  origStoragePath: string;
  contentHash: string;
}): FontFace {
  const { parsed, weight, weightName, width, italic, isVariable, axes, format, fileSize } = params;
  return {
    id: params.faceId ?? faceId(weightName, italic, isVariable),
    styleName: params.styleName ?? (isVariable
      ? italic ? "Italic Variable" : "Variable"
      : `${weightName}${italic ? " Italic" : ""}`),
    weight,
    weightName,
    width,
    italic,
    isVariable,
    axes,
    format,
    postScriptName: parsed.postScriptName,
    fullName: parsed.fullName,
    fileSize,
    filename: params.servedFilename,
    woff2: { storagePath: params.servedStoragePath, url: cdnUrl(params.servedStoragePath) },
    original: { storagePath: params.origStoragePath, url: cdnUrl(params.origStoragePath) },
    contentHash: params.contentHash,
    meta: {
      familyName: parsed.familyName,
      subfamilyName: parsed.subfamilyName,
      preferredFamily: parsed.preferredFamily,
      preferredSubfamily: parsed.preferredSubfamily,
      wwsFamilyName: parsed.wwsFamilyName,
      wwsSubfamilyName: parsed.wwsSubfamilyName,
      characterSetCoverage: parsed.characterSetCoverage,
      openTypeFeatures: parsed.openTypeFeatures,
      glyphCount: parsed.glyphCount,
      languageSupport: parsed.languageSupport,
      version: parsed.version,
      copyright: parsed.copyright,
      license: parsed.licenseUrl || undefined,
    },
  };
}
