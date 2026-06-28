// Parser-facing types. Pure declarations (exempt from the <100-line guideline).
// Trimmed to what the rebuilt pipeline consumes (parser/*); the legacy
// FontFamily/Font/EnrichedFontData schema was superseded by catalog.models.ts.

export type FontFormat = "TTF" | "OTF" | "WOFF" | "WOFF2" | "EOT";

/** Provenance for an extracted/computed field. */
export interface DataProvenance {
  source_type: "computed" | "extracted" | "web" | "inferred";
  source_ref?: string; // Table name (e.g., "name#1") or URL
  evidence?: string[]; // Metric keys that support this value
  timestamp: string;
  method?: string; // e.g., 'fontkit_parser'
  confidence: number; // 0.0–1.0
  source_rank?: number; // For web sources, trust ranking
}

export interface VisualMetrics {
  x_height_ratio?: number;
  contrast_index?: number;
  aperture_index?: number;
  serif_detected?: boolean;
  stress_angle_deg?: number;
  roundness?: number;
  spacing_stddev?: number;
  terminal_style?: "ball" | "teardrop" | "sheared" | "slab" | "bracketed" | "unknown";
  vision_embedding?: number[];
}
