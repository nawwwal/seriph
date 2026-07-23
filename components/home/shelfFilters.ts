import type { Classification } from '@/models/font.models';
import type { SearchIndexItem } from '@/models/search.models';
import type { ShelfFamily } from '@/models/shelf.models';

export type ShelfBuildFilter = 'variable' | 'static';

export interface ShelfFilterState {
  builds: ShelfBuildFilter[];
  classifications: string[];
  moods: string[];
}

export const emptyShelfFilters: ShelfFilterState = {
  builds: [],
  classifications: [],
  moods: [],
};

export const SHELF_CLASSIFICATIONS: readonly Classification[] = [
  'Sans Serif',
  'Serif',
  'Display & Decorative',
  'Script & Handwriting',
  'Monospace',
  'Symbol & Icon',
];

export function toggleFilterValue<Value extends string>(
  values: readonly Value[],
  value: Value,
): Value[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function hasShelfFilters(filters: ShelfFilterState): boolean {
  return filters.builds.length > 0
    || filters.classifications.length > 0
    || filters.moods.length > 0;
}

export function deriveShelfMoods(items: readonly SearchIndexItem[], limit = 10): string[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const mood of item.moods ?? []) {
      const key = mood.trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([mood]) => mood);
}

export function applyShelfFilters(
  families: readonly ShelfFamily[],
  filters: ShelfFilterState,
  indexById: ReadonlyMap<string, SearchIndexItem>,
): ShelfFamily[] {
  if (!hasShelfFilters(filters)) return [...families];
  return families.filter((family) => {
    if (filters.classifications.length > 0
      && !filters.classifications.includes(family.classification)) {
      return false;
    }
    const build: ShelfBuildFilter = family.isVariable ? 'variable' : 'static';
    if (filters.builds.length > 0 && !filters.builds.includes(build)) return false;
    if (filters.moods.length > 0) {
      const moods = indexById.get(family.id)?.moods
        ?? indexById.get(family.normalizedName)?.moods
        ?? [];
      if (!filters.moods.some((mood) => moods.includes(mood))) return false;
    }
    return true;
  });
}
