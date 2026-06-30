import type { PaginatedFamiliesResponse, ShelfFamily } from '@/models/shelf.models';
import { parseShelfFamilyPage, parseShelfStats } from '@/lib/shelf/familyPageParsing';
export { parseShelfFamilyPage, parseShelfStats } from '@/lib/shelf/familyPageParsing';

const CACHE_KEY = 'seriphShelfFamilies_v1';
const CACHE_TTL_MS = 60 * 60 * 1000;
export const FAMILY_PAGE_SIZE = 48;

function cacheKey(uid: string): string {
  return `${CACHE_KEY}_${uid}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
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

export function appendShelfFamilyPage(
  current: PaginatedFamiliesResponse,
  page: PaginatedFamiliesResponse
): PaginatedFamiliesResponse {
  const seen = new Set<string>();
  const families: ShelfFamily[] = [];
  for (const family of [...current.families, ...page.families]) {
    if (seen.has(family.id)) continue;
    seen.add(family.id);
    families.push(family);
  }
  return {
    families,
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
    ...(current.stats ?? page.stats ? { stats: current.stats ?? page.stats } : {}),
  };
}

export function mergeShelfRefreshPage(
  cached: PaginatedFamiliesResponse | null,
  page: PaginatedFamiliesResponse
): PaginatedFamiliesResponse {
  if (!cached || cached.families.length <= page.families.length) return page;
  const seen = new Set(page.families.map((family) => family.id));
  return {
    families: [...page.families, ...cached.families.filter((family) => !seen.has(family.id))],
    nextCursor: cached.nextCursor,
    hasMore: cached.hasMore,
    ...(cached.stats ?? page.stats ? { stats: cached.stats ?? page.stats } : {}),
  };
}

export function clearShelfFamilyCache(uid: string): void {
  try {
    localStorage.removeItem(cacheKey(uid));
  } catch {
    /* If storage is unavailable, network reload remains canonical. */
  }
}
