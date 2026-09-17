import type { GfCategory } from "../storage/canonicalize";

export type FamilyStatus = "ready" | "enriching" | "enriched" | "failed" | "merged";

export interface FontEnrichment {
  category: GfCategory;
  suggestedDisplayName?: string;
  classification?: string;
  summary?: string;
  moods?: string[];
  voice?: string;
  useCases?: string[];
  pairingHints?: string[];
  pairingFamilyIds?: string[];
  pairingFamilies?: Array<{ id: string; slug: string; name: string }>;
  searchClass?: string;
  moodScores?: Record<string, number>;
  useCaseScores?: Record<string, number>;
  confidence?: number;
  modelId?: string;
  promptVersion?: string;
  jevModel?: string;
  jevVersion?: string;
  embeddingModel?: string;
  embeddingVersion?: string;
  enrichedAt?: FirebaseFirestore.Timestamp | Date | string;
}

export interface SearchMeta {
  embeddingModel: string;
  embeddingVersion: string;
  promptVersion: string;
  generatedAt?: FirebaseFirestore.Timestamp | Date | string;
}
