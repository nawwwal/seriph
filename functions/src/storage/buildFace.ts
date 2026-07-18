import { cdnUrl } from "../config/catalogConfig";
import type { CanonicalAxis, FontFace } from "../models/catalog.models";
import type { FontAsset } from "../models/catalog.assets";
import type { FontFormat } from "./transcode";

type BuildFaceParams = {
  parsed: any; faceId?: string; styleName?: string; weight: number; weightName: string;
  width: number; italic: boolean; isVariable: boolean; axes?: CanonicalAxis[];
  format?: FontFormat; fileSize?: number; servedFilename?: string;
  servedStoragePath?: string; origStoragePath?: string; contentHash?: string;
  assets?: readonly FontAsset[]; preferredAssetId?: string;
};

const basename = (path: string): string => path.split(/[\\/]/).pop() || path;

function sortedAssets(assets: readonly FontAsset[]): FontAsset[] {
  const ids = new Set<string>();
  for (const asset of assets) {
    if (ids.has(asset.id)) throw new Error(`duplicate asset id: ${asset.id}`);
    ids.add(asset.id);
  }
  return [...assets].sort((a, b) => a.id.localeCompare(b.id));
}

function preferredAsset(assets: FontAsset[], preferredId?: string): FontAsset {
  if (preferredId) {
    const explicit = assets.find((asset) => asset.id === preferredId);
    if (!explicit) throw new Error(`preferred asset not found: ${preferredId}`);
    return explicit;
  }
  return [...assets].sort((a, b) => Number(b.containerFormat === "WOFF2")
    - Number(a.containerFormat === "WOFF2") || a.id.localeCompare(b.id))[0]!;
}

function legacyAsset(params: BuildFaceParams): FontAsset | undefined {
  const { format, servedStoragePath, origStoragePath, servedFilename, contentHash } = params;
  if (!format || !servedStoragePath || !origStoragePath || !servedFilename || !contentHash) return undefined;
  return {
    id: contentHash, contentHash, containerFormat: format, technology: format,
    originalName: basename(origStoragePath),
    original: { storagePath: origStoragePath, url: cdnUrl(origStoragePath) },
    served: { storagePath: servedStoragePath, url: cdnUrl(servedStoragePath) },
    source: { batchId: "", sourceId: "", itemId: contentHash, originalPath: origStoragePath },
  };
}

function projectAssets(params: BuildFaceParams): Partial<FontFace> {
  if (!params.assets) return {};
  if (!params.assets.length) throw new Error("at least one asset is required");
  const assets = sortedAssets(params.assets);
  const preferred = preferredAsset(assets, params.preferredAssetId);
  const served = preferred.served ?? preferred.original;
  return {
    assets, preferredAssetId: preferred.id, technology: preferred.technology,
    format: preferred.containerFormat,
    filename: basename(preferred.served?.storagePath ?? preferred.originalName),
    woff2: served, original: preferred.original, contentHash: preferred.contentHash,
  };
}

/** Stable face id, e.g. "semibold", "bold-italic", or "vf"/"vf-italic". */
export function faceId(weightName: string, italic: boolean, isVariable: boolean): string {
  if (isVariable) return italic ? "vf-italic" : "vf";
  return `${weightName.toLowerCase()}${italic ? "-italic" : ""}`;
}

/** Assemble the FontFace document from parsed metadata and written asset paths. */
export function buildFace(params: BuildFaceParams): FontFace {
  const { parsed, weight, weightName, width, italic, isVariable, axes, format, fileSize } = params;
  const legacy = legacyAsset(params);
  const projected = projectAssets(params);
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
    format: projected.format ?? format ?? legacy?.containerFormat ?? "OTF",
    postScriptName: parsed.postScriptName,
    fullName: parsed.fullName,
    fileSize: fileSize ?? 0,
    filename: projected.filename ?? params.servedFilename ?? legacy?.originalName ?? "font",
    woff2: projected.woff2 ?? legacy?.served ?? { storagePath: "", url: "" },
    original: projected.original ?? legacy?.original ?? { storagePath: "", url: "" },
    contentHash: projected.contentHash ?? legacy?.contentHash,
    ...projected,
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
