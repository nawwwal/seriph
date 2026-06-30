import type { Classification } from '@/models/font.models';
import type { ShelfCoverFace } from '@/models/shelf.models';

export type SearchResultSource = 'local' | 'semantic';
export type SearchVariableFilter = 'any' | 'variable' | 'static';
export type SearchStyleRange = '1' | '2-4' | '5-8' | '9+';

export interface SearchFilters {
  classifications: string[];
  moods: string[];
  styleRanges: SearchStyleRange[];
  variable: SearchVariableFilter;
}

export interface SearchFacetOption {
  value: string;
  label: string;
  count: number;
}

export interface SearchFacets {
  classifications: SearchFacetOption[];
  moods: SearchFacetOption[];
  styleRanges: SearchFacetOption[];
  variable: SearchFacetOption[];
}

export interface SearchResultItem {
  id: string;
  slug: string;
  name: string;
  normalizedName: string;
  category: string;
  classification: Classification;
  summary?: string;
  moods?: string[];
  useCases?: string[];
  styleCount: number;
  isVariable: boolean;
  updatedAt: string;
  coverUrl?: string;
  coverFace?: ShelfCoverFace;
  score?: number;
  source?: SearchResultSource;
  scoreBreakdown?: unknown;
}

export interface SearchIndexItem extends SearchResultItem {
  searchText: string;
  searchPrimaryText?: string;
  searchSecondaryText?: string;
  searchTokens: string[];
}

export interface SearchIndexResponse {
  items: SearchIndexItem[];
  generatedAt: string;
}
