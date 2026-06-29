import type { PaginatedFamiliesResponse, ShelfFamily } from '@/models/shelf.models';

const CACHE_KEY = 'seriphShelfFamilies_v1';
const CACHE_TTL_MS = 60 * 60 * 1000;
export const FAMILY_PAGE_SIZE = 48;

function cacheKey(uid: string): string {
  return `${CACHE_KEY}_${uid}`;
}

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

export function parseShelfFamilyPage(value: unknown): PaginatedFamiliesResponse | null {
  if (!isRecord(value)) return null;
  const page = value;
  if (!Array.isArray(page.families) || !page.families.every(isShelfFamily)) return null;
  return {
    families: page.families,
    nextCursor: typeof page.nextCursor === 'string' ? page.nextCursor : null,
    hasMore: page.hasMore === true,
  };
}

export function readShelfFamilyCache(uid: string): PaginatedFamiliesResponse | null {
  try {
    const raw = localStorage.getItem(cacheKey(uid));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    const wrapper = parsed;
    if (typeof wrapper.timestamp !== 'number' || Date.now() - wrapper.timestamp > CACHE_TTL_MS) return null;
    return parseShelfFamilyPage(wrapper.data);
  } catch {
    return null;
  }
}

export function writeShelfFamilyCache(uid: string, data: PaginatedFamiliesResponse): void {
  try {
    localStorage.setItem(cacheKey(uid), JSON.stringify({ timestamp: Date.now(), data }));
  } catch {
    /* localStorage quota can be exhausted; the network path remains canonical. */
  }
}

export function clearShelfFamilyCache(uid: string): void {
  try {
    localStorage.removeItem(cacheKey(uid));
  } catch {
    /* If storage is unavailable, network reload remains canonical. */
  }
}
