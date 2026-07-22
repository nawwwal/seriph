'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useUploads } from '@/lib/contexts/UploadContext';
import { clearFamilyDetailNegativeCacheForUser } from '@/lib/cache/familyDetailClient';
import { clearShelfFamilyCache, useInfiniteFamilies } from '@/lib/hooks/useInfiniteFamilies';
import { useShelfMutations } from '@/lib/hooks/useShelfMutations';
import { useSearchIndex } from '@/lib/hooks/useSearchIndex';
import {
  deriveAvailableInitials,
  filterFamiliesByInitial,
  type AlphabetInitial,
  type LetterInitial,
} from './alphabetFilter';
import {
  applyShelfFilters,
  deriveShelfMoods,
  emptyShelfFilters,
  type ShelfFilterState,
} from './shelfFilters';
import type { User } from 'firebase/auth';

export function useHomeShelfView(user: User) {
  const { onCompleted, openImport } = useUploads();
  const shelf = useInfiniteFamilies();
  const searchIndex = useSearchIndex({ enabled: true });
  const [selectedInitial, setSelectedInitial] = useState<AlphabetInitial>('ALL');
  const [filters, setFilters] = useState<ShelfFilterState>(emptyShelfFilters);

  const refreshShelf = useCallback(async () => {
    clearFamilyDetailNegativeCacheForUser(user.uid);
    clearShelfFamilyCache(user.uid);
    await shelf.reload();
  }, [shelf, user.uid]);
  const mutations = useShelfMutations({ user, refreshShelf });

  useEffect(() => onCompleted(() => { void refreshShelf(); }), [onCompleted, refreshShelf]);

  const presentInitials = useMemo(
    () => new Set(deriveAvailableInitials(shelf.families)) as Set<LetterInitial>,
    [shelf.families],
  );
  const activeInitial = selectedInitial !== 'ALL' && !presentInitials.has(selectedInitial)
    ? 'ALL'
    : selectedInitial;
  const indexById = useMemo(() => {
    const map = new Map(searchIndex.items.map((item) => [item.id, item]));
    for (const item of searchIndex.items) map.set(item.normalizedName, item);
    return map;
  }, [searchIndex.items]);

  const visibleFamilies = useMemo(() => {
    const byFilters = applyShelfFilters(shelf.families, filters, indexById);
    return filterFamiliesByInitial(byFilters, activeInitial);
  }, [activeInitial, filters, indexById, shelf.families]);
  const moods = useMemo(() => deriveShelfMoods(searchIndex.items), [searchIndex.items]);

  const showShelfSkeleton = shelf.isInitialLoading && shelf.families.length === 0;
  const isEmpty = !showShelfSkeleton && shelf.families.length === 0;
  const hasBlockingError = Boolean(shelf.error && shelf.families.length === 0);

  return {
    shelf,
    mutations,
    handleAddFonts: openImport,
    activeInitial,
    setSelectedInitial,
    presentInitials,
    filters,
    setFilters,
    moods,
    visibleFamilies,
    showShelfSkeleton,
    isEmpty,
    hasBlockingError,
  };
}
