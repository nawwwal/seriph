import type { SearchScoreBreakdown } from "./scoring";

export interface SearchRequest {
  q?: string;
  filters?: {
    category?: string;
    ownerId?: string;
    isVariable?: boolean;
    classifications?: string[];
    moods?: string[];
    styleRanges?: Array<"1" | "2-4" | "5-8" | "9+">;
    variable?: "any" | "variable" | "static";
  };
  limit?: number;
  debug?: boolean;
}

export interface SearchResultItem {
  id: string;
  slug: string;
  name: string;
  category: string;
  classification?: string;
  summary?: string;
  moods?: string[];
  useCases?: string[];
  coverUrl?: string;
  styleCount: number;
  isVariable?: boolean;
  updatedAt?: string;
  score?: number;
  scoreBreakdown?: SearchScoreBreakdown;
}
