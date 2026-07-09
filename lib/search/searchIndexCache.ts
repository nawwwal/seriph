import type { SearchIndexItem, SearchIndexResponse } from '@/models/search.models';
import type { ShelfFamily } from '@/models/shelf.models';

const CACHE_KEY = 'seriphSearchIndex_v2';
const SHELF_CACHE_KEY = 'seriphShelfFamilies_v2';
const CACHE_TTL_MS = 60 * 60 * 1000;

function cacheKey(uid: string, prefix: string): string {
  return `${prefix}_${uid}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isSearchIndexItem(value: unknown): value is SearchIndexItem {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.slug === 'string'
    && typeof value.name === 'string'
    && typeof value.searchText === 'string'
    && Array.isArray(value.searchTokens);
}

function readWrappedData(uid: string, prefix: string): unknown {
  try {
    const raw = localStorage.getItem(cacheKey(uid, prefix));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || typeof parsed.timestamp !== 'number') return null;
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function readSearchIndexCache(uid: string): SearchIndexResponse | null {
  const data = readWrappedData(uid, CACHE_KEY);
  if (!isRecord(data) || !Array.isArray(data.items) || !data.items.every(isSearchIndexItem)) return null;
  return { items: data.items, generatedAt: typeof data.generatedAt === 'string' ? data.generatedAt : '' };
}

export function writeSearchIndexCache(uid: string, data: SearchIndexResponse): void {
  try {
    localStorage.setItem(cacheKey(uid, CACHE_KEY), JSON.stringify({ timestamp: Date.now(), data }));
  } catch {
    /* Search still works through the network path if storage is unavailable. */
  }
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

export function readShelfSearchSeed(uid: string): SearchIndexResponse | null {
  const data = readWrappedData(uid, SHELF_CACHE_KEY);
  if (!isRecord(data) || !Array.isArray(data.families) || !data.families.every(isShelfFamily)) return null;
  const items = data.families.map((family) => ({
    ...family,
    slug: family.normalizedName,
    category: family.classification,
    searchText: [family.name, family.normalizedName, family.classification].join(' '),
    searchPrimaryText: [family.name, family.normalizedName, family.classification].join(' '),
    searchSecondaryText: '',
    searchTokens: [family.name, family.normalizedName, family.classification].flatMap((part) => part.toLowerCase().split(/[^a-z0-9]+/)).filter(Boolean),
    source: 'local' as const,
  }));
  return { items, generatedAt: '' };
}
