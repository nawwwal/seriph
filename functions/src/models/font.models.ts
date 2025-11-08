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

// Provenance tracking
export interface DataProvenance {
  source_type: 'computed' | 'extracted' | 'web' | 'inferred';
  source_ref?: string; // Table name (e.g., "name#1") or URL
  evidence?: string[]; // Metric keys that support this value
  timestamp: string;
  method?: string; // e.g., 'fontkit_parser', 'gemini_2.5_flash', 'harfbuzz_shaping'
  confidence: number; // 0.0-1.0
  source_rank?: number; // For web sources, trust ranking
}

export interface FieldWithProvenance<T> {
  value: T;
  sources: DataProvenance[];
  confidence: number; // Weighted harmonic mean of source confidences
}

export interface VisualMetrics {
  x_height_ratio?: number;
  contrast_index?: number;
  aperture_index?: number;
  serif_detected?: boolean;
  stress_angle_deg?: number;
  roundness?: number;
  spacing_stddev?: number;
  terminal_style?: 'ball' | 'teardrop' | 'sheared' | 'slab' | 'bracketed' | 'unknown';
  vision_embedding?: number[]; // Vector for similarity search
}

export interface SemanticClassification {
  style_primary: FieldWithProvenance<Classification>;
  substyle?: FieldWithProvenance<string>;
  moods: Array<FieldWithProvenance<string>>;
  use_cases: Array<FieldWithProvenance<string>>;
  negative_tags?: string[]; // What it is NOT
  axis_aware_semantics?: {
    [axisValue: string]: {
      moods?: string[];
      use_cases?: string[];
    };
  };
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
  // Enhanced fields
  fingerprint?: string; // family + version + vendor + Panose + glyph hash subset
  visual_metrics?: VisualMetrics;
  scripts?: Array<{
    script: string; // ISO 15924 code
    coverage_pct: number;
    shaping_verified: boolean; // HarfBuzz check passed
  }>;
  color?: {
    present: boolean;
    formats: string[]; // 'COLR', 'CBDT', 'sbix', 'SVG'
    layer_count?: number;
    palette_count?: number;
  };
  similar_fonts?: Array<{
    font_id: string;
    method: 'vision_embedding' | 'fingerprint' | 'glyph_hash';
    distance: number;
  }>;
  provenance?: {
    [key: string]: DataProvenance[];
  };
  // Placeholder for other metadata
  [key: string]: any;
}

export interface FamilyMetadata {
  // Placeholder for family-specific metadata
  foundry?: string; // Already in use in firestoreUtils, ensure it's formally here
  subClassification?: string; // AI-generated
  moods?: string[]; // AI-generated, e.g., ["elegant", "modern", "playful"]
  useCases?: string[]; // AI-generated, e.g., ["headings", "body text", "branding"]
  similarFamilies?: string[]; // AI-generated, e.g., ["Helvetica", "Arial"]
  technicalCharacteristics?: string[]; // AI-generated, e.g., ["highly legible", "good for web"]
  // Enhanced fields
  people?: Array<{
    role: 'designer' | 'foundry' | 'contributor';
    name: string;
    source: 'extracted' | 'web';
    confidence: number;
    source_url?: string;
  }>;
  historical_context?: {
    period?: string; // e.g., "1920s", "Modernist era"
    cultural_influence?: string[];
    notable_usage?: string[];
    provenance: DataProvenance[];
  };
  license?: {
    type: 'OFL' | 'Apache' | 'Proprietary' | 'Unknown';
    url?: string;
    fsType_flags?: string[];
    confidence: number;
    sources: DataProvenance[];
  };
  semantics?: SemanticClassification;
  provenance?: {
    [key: string]: DataProvenance[];
  };
  // [key: string]: any; // Keep for flexibility if needed, or remove if all fields are defined
}

export interface FontFamily {
  id: string;
  name: string;
  normalizedName: string;
  ownerId?: string;
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

// Canonical enriched font data schema
export interface EnrichedFontData {
  id: string; // hash_of_fontfile
  family: FieldWithProvenance<string>;
  version?: FieldWithProvenance<string>;
  license?: {
    type: 'OFL' | 'Apache' | 'Proprietary' | 'Unknown';
    url?: string;
    fsType_flags?: string[];
    confidence: number;
    sources: DataProvenance[];
  };
  technical: {
    style_core: Classification;
    substyle?: string;
    variable_axes: VariableAxis[];
    features: string[];
    scripts: Array<{
      script: string; // ISO 15924 code
      coverage_pct: number;
      shaping_verified?: boolean;
    }>;
    color: {
      present: boolean;
      formats: string[];
      layer_count?: number;
      palette_count?: number;
    };
  };
  metrics: VisualMetrics;
  semantics: SemanticClassification;
  people?: Array<{
    role: 'designer' | 'foundry' | 'contributor';
    name: string;
    source: 'extracted' | 'web';
    confidence: number;
    source_url?: string;
  }>;
  historical_context?: {
    period?: string;
    cultural_influence?: string[];
    notable_usage?: string[];
    provenance: DataProvenance[];
  };
  similar_fonts?: Array<{
    id: string;
    method: 'vision_embedding' | 'fingerprint' | 'glyph_hash';
    distance: number;
  }>;
  provenance: DataProvenance[];
}
