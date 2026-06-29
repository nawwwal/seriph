import type { Classification } from "./font-types.models";

export interface DataProvenance {
  source_type: "computed" | "extracted" | "web" | "inferred";
  source_ref?: string;
  evidence?: string[];
  timestamp: string;
  method?: string;
  confidence: number;
  source_rank?: number;
}

export interface FieldWithProvenance<T> {
  value: T;
  sources: DataProvenance[];
  confidence: number;
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

export interface SemanticClassification {
  style_primary: FieldWithProvenance<Classification>;
  substyle?: FieldWithProvenance<string>;
  moods: Array<FieldWithProvenance<string>>;
  use_cases: Array<FieldWithProvenance<string>>;
  negative_tags?: string[];
  axis_aware_semantics?: Record<string, {
    moods?: string[];
    use_cases?: string[];
  }>;
}
