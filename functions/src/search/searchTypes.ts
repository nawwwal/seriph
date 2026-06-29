import type { SearchScoreBreakdown } from "./scoring";

export interface SearchRequest {
  q?: string;
  filters?: { category?: string; ownerId?: string; isVariable?: boolean };
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
  coverUrl?: string;
  styleCount: number;
  score?: number;
  scoreBreakdown?: SearchScoreBreakdown;
}
