import type { Classification } from './font.models';

export interface ShelfCoverFace {
  id: string;
  subfamily: string;
  weight: number;
  italic: boolean;
  isVariable: boolean;
  cdnUrl?: string;
}

export interface ShelfFamily {
  id: string;
  name: string;
  normalizedName: string;
  classification: Classification;
  styleCount: number;
  isVariable: boolean;
  updatedAt: string;
  coverFace?: ShelfCoverFace;
}

export interface ShelfStatsSummary {
  familyCount: number;
  styleCount: number;
  recentFamilyName: string | null;
  generatedAt: string;
  libraryRevision: number;
  updatedAt: string;
}

export interface FamilyCursor {
  sortValue: string;
  id: string;
}

export interface PaginatedFamiliesResponse {
  families: ShelfFamily[];
  nextCursor: string | null;
  hasMore: boolean;
  stats?: ShelfStatsSummary;
}
