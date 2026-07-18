import type { FontTechnology } from "../imports/planning/technology";
import type { FontFormat } from "../storage/transcode";

export interface CanonicalAxis {
  tag: string;
  min: number;
  max: number;
  default: number;
  name?: string;
}

export interface ServedAsset {
  storagePath: string;
  url: string;
}

export interface FontAsset {
  id: string;
  contentHash: string;
  containerFormat: FontFormat;
  technology: FontTechnology;
  parsedVersion?: string;
  original: ServedAsset;
  served?: ServedAsset;
  originalName: string;
  source: { batchId: string; sourceId: string; itemId: string; originalPath: string };
}

export interface FontFaceMeta {
  familyName?: string;
  subfamilyName?: string;
  preferredFamily?: string;
  preferredSubfamily?: string;
  wwsFamilyName?: string;
  wwsSubfamilyName?: string;
  characterSetCoverage?: string[];
  openTypeFeatures?: string[];
  glyphCount?: number;
  languageSupport?: string[];
  version?: string;
  copyright?: string;
  license?: string;
}

export interface FontFace {
  id: string;
  styleName: string;
  weight: number;
  weightName: string;
  width?: number;
  italic: boolean;
  isVariable: boolean;
  axes?: CanonicalAxis[];
  format: string;
  postScriptName?: string;
  fullName?: string;
  fileSize: number;
  filename: string;
  woff2: ServedAsset;
  original: ServedAsset;
  contentHash?: string;
  technology?: FontTechnology;
  assets?: FontAsset[];
  preferredAssetId?: string;
  meta?: FontFaceMeta;
}
