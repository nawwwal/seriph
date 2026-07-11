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
  meta?: FontFaceMeta;
}
