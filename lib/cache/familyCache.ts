import type { FontFamily } from '@/models/font.models';

/**
 * Process-wide in-memory cache of fully-adapted families, keyed by id. The shelf
 * loads every family into memory anyway, so family-detail navigation can be
 * served instantly from here instead of refetching by id on each visit. Survives
 * client-side route changes (module singleton); cleared on full reload.
 */
const familiesById = new Map<string, FontFamily>();

export function cacheFamilies(families: FontFamily[]): void {
  for (const family of families) familiesById.set(family.id, family);
}

export function cacheFamily(family: FontFamily): void {
  familiesById.set(family.id, family);
}

export function getCachedFamily(id: string | undefined): FontFamily | undefined {
  return id ? familiesById.get(id) : undefined;
}
