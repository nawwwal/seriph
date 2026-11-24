'use client';

import { startTransition, useCallback, useMemo, useState } from 'react';
import { useUploadActions } from '@/lib/contexts/UploadContext';
import { clearFamilyDetailNegativeCacheForUser } from '@/lib/cache/familyDetailClient';
import { clearShelfFamilyCache, useInfiniteFamilies } from '@/lib/hooks/useInfiniteFamilies';
import { useShelfMutations } from '@/lib/hooks/useShelfMutations';
import { useSearchIndex } from '@/lib/hooks/useSearchIndex';
import { useMergeSuggestions } from '@/lib/hooks/useMergeSuggestions';
import { clearSearchIndexCache } from '@/lib/search/searchIndexCache';
import type { SearchIndexItem } from '@/models/search.models';
import type { ShelfFamily } from '@/models/shelf.models';
import { deriveAvailableInitials, filterFamiliesByInitial, type AlphabetInitial, type LetterInitial } from './alphabetFilter';
import { applyShelfFilters, deriveShelfMoods, emptyShelfFilters, hasShelfFilters, type ShelfFilterState } from './shelfFilters';
import type { User } from 'firebase/auth';
import { useEffect } from 'react';

function indexItemToShelfFamily(item: SearchIndexItem): ShelfFamily {
  return {
    id: item.slug || item.id,
    name: item.name,
    normalizedName: item.normalizedName || item.slug || item.id,
    classification: item.classification,
    styleCount: item.styleCount,
    isVariable: item.isVariable,
    updatedAt: item.updatedAt,
    coverFace: item.coverFace,
  };
}

export function useHomeShelfView(user: User) {
  const { onCompleted, openImport } = useUploadActions();
  const shelf = useInfiniteFamilies();
  const searchIndex = useSearchIndex({ enabled: !shelf.isInitialLoading && shelf.families.length > 0 });
  const [selectedInitial, setSelectedInitial] = useState<AlphabetInitial>('ALL');
  const [filters, setFilters] = useState<ShelfFilterState>(emptyShelfFilters);
  const merge = useMergeSuggestions(user);

  const refreshShelf = useCallback(async () => {
    clearFamilyDetailNegativeCacheForUser(user.uid);
    clearSearchIndexCache(user.uid);
    await clearShelfFamilyCache(user.uid);
    await shelf.reload();
    void searchIndex.reload();
    merge.reload();
  }, [merge, searchIndex, shelf, user.uid]);
  const mutations = useShelfMutations({ user, refreshShelf });
  useEffect(() => onCompleted(() => { void refreshShelf(); }), [onCompleted, refreshShelf]);

  const initialSource = searchIndex.items.length > 0 ? searchIndex.items : shelf.families;
  const presentInitials = useMemo(() => new Set(deriveAvailableInitials(initialSource)) as Set<LetterInitial>, [initialSource]);
  const activeInitial = selectedInitial !== 'ALL' && !presentInitials.has(selectedInitial) ? 'ALL' : selectedInitial;
  const indexById = useMemo(() => {
    const map = new Map(searchIndex.items.map((item) => [item.id, item]));
    for (const item of searchIndex.items) { map.set(item.slug, item); map.set(item.normalizedName, item); }
    return map;
  }, [searchIndex.items]);

  const hasActiveFilters = activeInitial !== 'ALL' || hasShelfFilters(filters);
  const fullPool = useMemo(() => {
    if (!hasActiveFilters || searchIndex.items.length === 0) return shelf.families;
    const byId = new Map(shelf.families.map((family) => [family.id, family]));
    for (const item of searchIndex.items) {
      const key = item.slug || item.id;
      if (!byId.has(key)) byId.set(key, indexItemToShelfFamily(item));
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [hasActiveFilters, searchIndex.items, shelf.families]);

  const visibleFamilies = useMemo(() => {
    const byFilters = applyShelfFilters(fullPool, filters, indexById);
    return filterFamiliesByInitial(byFilters, activeInitial);
  }, [activeInitial, filters, fullPool, indexById]);
  const moods = useMemo(() => deriveShelfMoods(searchIndex.items), [searchIndex.items]);

  const updateInitial = useCallback((next: AlphabetInitial) => startTransition(() => setSelectedInitial(next)), []);
  const updateFilters = useCallback((next: ShelfFilterState) => startTransition(() => setFilters(next)), []);
  const resetFilters = useCallback(() => startTransition(() => { setSelectedInitial('ALL'); setFilters(emptyShelfFilters); }), []);

  const showShelfSkeleton = shelf.isInitialLoading && shelf.families.length === 0;
  return {
    shelf, mutations, mergeSuggestions: merge.suggestions, onDismissSuggestion: merge.dismiss,
    handleAddFonts: openImport, activeInitial, setSelectedInitial: updateInitial, presentInitials,
    filters, setFilters: updateFilters, hasActiveFilters, resetFilters, moods, visibleFamilies,
    showShelfSkeleton, isEmpty: !showShelfSkeleton && shelf.families.length === 0,
    hasBlockingError: Boolean(shelf.error && shelf.families.length === 0),
  };
}
