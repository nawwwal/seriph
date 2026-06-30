import type { Classification } from '@/models/font.models';
import type { SearchIndexResponse, SearchResultItem } from '@/models/search.models';
import type { ShelfCoverFace } from '@/models/shelf.models';
import { canonicalSearchClassification } from '@/lib/search/searchClassification';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function classification(value: unknown): Classification {
  return canonicalSearchClassification(value) ?? 'Sans Serif';
}

function coverFace(value: unknown, fallbackUrl?: string): ShelfCoverFace | undefined {
  if (isRecord(value) && typeof value.id === 'string' && typeof value.subfamily === 'string') {
    return {
      id: value.id,
      subfamily: value.subfamily,
      weight: typeof value.weight === 'number' ? value.weight : 400,
      italic: value.italic === true,
      isVariable: value.isVariable === true,
      cdnUrl: typeof value.cdnUrl === 'string' ? value.cdnUrl : fallbackUrl,
    };
  }
  return fallbackUrl ? { id: 'cover', subfamily: 'Regular', weight: 400, italic: false, isVariable: false, cdnUrl: fallbackUrl } : undefined;
}

export function normalizeSearchResult(value: unknown): SearchResultItem | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') return null;
  const slug = typeof value.slug === 'string' ? value.slug : value.id;
  const coverUrl = typeof value.coverUrl === 'string' ? value.coverUrl : undefined;
  return {
    id: value.id,
    slug,
    normalizedName: typeof value.normalizedName === 'string' ? value.normalizedName : slug,
    name: value.name,
    category: typeof value.category === 'string' ? value.category : '',
    classification: classification(value.classification),
    summary: typeof value.summary === 'string' ? value.summary : undefined,
    moods: Array.isArray(value.moods) ? value.moods.filter((item): item is string => typeof item === 'string') : undefined,
    useCases: Array.isArray(value.useCases) ? value.useCases.filter((item): item is string => typeof item === 'string') : undefined,
    styleCount: typeof value.styleCount === 'number' ? value.styleCount : 0,
    isVariable: value.isVariable === true,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : '',
    coverUrl,
    coverFace: coverFace(value.coverFace, coverUrl),
    score: typeof value.score === 'number' ? value.score : undefined,
    scoreBreakdown: value.scoreBreakdown,
    source: 'semantic',
  };
}

export function isSearchIndexItem(value: unknown): value is SearchIndexResponse['items'][number] {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.slug === 'string'
    && typeof value.name === 'string'
    && typeof value.searchText === 'string'
    && Array.isArray(value.searchTokens);
}

export { isRecord };
