import type { PaginatedFamiliesResponse, ShelfFamily, ShelfStatsSummary } from '@/models/shelf.models';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isShelfFamily(value: unknown): value is ShelfFamily {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.normalizedName === 'string'
    && typeof value.classification === 'string'
    && typeof value.styleCount === 'number'
    && typeof value.isVariable === 'boolean'
    && typeof value.updatedAt === 'string';
}

export function parseShelfStats(value: unknown): ShelfStatsSummary | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.familyCount === 'number'
    && typeof value.styleCount === 'number'
    && (typeof value.recentFamilyName === 'string' || value.recentFamilyName === null)
    && typeof value.generatedAt === 'string'
  ) return {
    familyCount: value.familyCount,
    styleCount: value.styleCount,
    recentFamilyName: value.recentFamilyName,
    generatedAt: value.generatedAt,
  };
  return null;
}

function isShelfStats(value: unknown): value is NonNullable<PaginatedFamiliesResponse['stats']> {
  return parseShelfStats(value) !== null;
}

export function parseShelfFamilyPage(value: unknown): PaginatedFamiliesResponse | null {
  if (!isRecord(value)) return null;
  const page = value;
  if (!Array.isArray(page.families) || !page.families.every(isShelfFamily)) return null;
  return {
    families: page.families,
    nextCursor: typeof page.nextCursor === 'string' ? page.nextCursor : null,
    hasMore: page.hasMore === true,
    ...(isShelfStats(page.stats) ? { stats: page.stats } : {}),
  };
}
