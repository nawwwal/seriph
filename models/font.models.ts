export type Classification =
  | "Serif"
  | "Sans Serif"
  | "Script & Handwriting"
  | "Monospace"
  | "Display & Decorative"
  | "Symbol & Icon";

export const CLASSIFICATION_VALUES: Classification[] = [
  "Serif",
  "Sans Serif",
  "Script & Handwriting",
  "Monospace",
  "Display & Decorative",
  "Symbol & Icon"
];

export type FontFormat = "TTF" | "OTF" | "WOFF" | "WOFF2" | "EOT";

export const FONT_FORMAT_VALUES: FontFormat[] = ["TTF", "OTF", "WOFF", "WOFF2", "EOT"];

export type FontStyle =
  | "Thin"
  | "ExtraLight"
  | "Light"
  | "Regular"
  | "Medium"
  | "SemiBold"
  | "Bold"
  | "ExtraBold"
  | "Black"
  | "Italic"
  | "Thin Italic"
  | "ExtraLight Italic"
  | "Light Italic"
  | "Regular Italic"
  | "Medium Italic"
  | "SemiBold Italic"
  | "Bold Italic"
  | "ExtraBold Italic"
  | "Black Italic";

export interface VariableAxis {
  tag: string; // e.g., 'wght'
  name: string; // e.g., 'Weight'
  minValue: number;
  maxValue: number;
  defaultValue: number;
}

export interface FontMetadata {
  // Core Font Properties from spec (Section 2.2)
  postScriptName?: string;
  version?: string;
  copyright?: string;
  license?: string;
  characterSetCoverage?: string[]; // Unicode ranges
  openTypeFeatures?: string[];
  // Advanced Analysis from spec (Section 2.2)
  glyphCount?: number;
  languageSupport?: string[];
  kerningPairDensity?: number; // Could be a number or a qualitative measure
  // Placeholder for other metadata
  [key: string]: any;
}

export interface FamilyMetadata {
  // Placeholder for family-specific metadata
  [key: string]: any;
}

export interface FontFamily {
  id: string;
  name: string;
  normalizedName: string;
  foundry?: string;
  description: string; // AI-generated
  tags: string[];
  classification: Classification;
  metadata: FamilyMetadata;
  fonts: Font[];
  uploadDate: string;
  lastModified: string;
}

export interface Font {
  id: string;
  filename: string;
  format: FontFormat;
  subfamily: string; // e.g., Regular, Bold, Italic
  weight: number; // Numerical weight (e.g., 400 for Regular, 700 for Bold)
  style: FontStyle; // Descriptive style
  isVariable: boolean;
  variableAxes?: VariableAxis[];
  fileSize: number; // in bytes
  downloadUrl: string;
  metadata: FontMetadata;
}
