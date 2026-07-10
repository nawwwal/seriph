import type { Classification, FontFormat, FontStyle, VariableAxis } from "./font-types.models";
import type { DataProvenance, SemanticClassification } from "./font-provenance.models";

export interface FontMetadata {
  postScriptName?: string;
  version?: string;
  copyright?: string;
  license?: string;
  characterSetCoverage?: string[];
  openTypeFeatures?: string[];
  glyphCount?: number;
  languageSupport?: string[];
  kerningPairDensity?: number;
  storagePath?: string | null;
  [key: string]: unknown;
}

export interface FamilyEnrichment {
  classification?: string;
  summary?: string;
  moods?: string[];
  voice?: string;
  useCases?: string[];
  pairingHints?: string[];
  confidence?: number;
  enrichedAt?: string;
}

export interface FamilyMetadata {
  foundry?: string;
  subClassification?: string;
  moods?: string[];
  useCases?: string[];
  similarFamilies?: string[];
  technicalCharacteristics?: string[];
  people?: Array<{
    role: "designer" | "foundry" | "contributor";
    name: string;
    source: "extracted" | "web";
    confidence: number;
    source_url?: string;
  }>;
  historical_context?: {
    period?: string;
    cultural_influence?: string[];
    notable_usage?: string[];
    provenance: DataProvenance[];
  };
  license?: {
    type: "OFL" | "Apache" | "Proprietary" | "Unknown";
    url?: string;
    fsType_flags?: string[];
    confidence: number;
    sources: DataProvenance[];
  };
  semantics?: SemanticClassification;
  provenance?: Record<string, DataProvenance[]>;
  enrichment?: FamilyEnrichment;
}

export interface FontFamily {
  id: string;
  name: string;
  normalizedName: string;
  ownerId?: string;
  foundry?: string;
  description: string;
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
  subfamily: string;
  weight: number;
  style: FontStyle;
  isVariable: boolean;
  variableAxes?: VariableAxis[];
  fileSize: number;
  metadata: FontMetadata;
}
