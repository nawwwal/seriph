'use client';

import ShelfSkeleton from '@/components/home/ShelfSkeleton';
import ShelfState from '@/components/home/ShelfState';
import WelcomeState from '@/components/home/WelcomeState';
import MergeSuggestionsBar from '@/components/home/MergeSuggestionsBar';
import type { FamilyMergeSuggestion } from '@/lib/api/mergeSuggestions';
import type { useInfiniteFamilies } from '@/lib/hooks/useInfiniteFamilies';
import type { useShelfMutations } from '@/lib/hooks/useShelfMutations';
import type { ShelfFamily } from '@/models/shelf.models';

type ShelfController = ReturnType<typeof useInfiniteFamilies>;
type ShelfMutations = ReturnType<typeof useShelfMutations>;

interface HomePageShelfContentProps {
  shelf: ShelfController;
  families: ShelfFamily[];
  mutations: ShelfMutations;
  mergeSuggestions: FamilyMergeSuggestion[];
  onDismissSuggestion?: (suggestionId: string) => void;
  hasActiveFilters?: boolean;
  onResetFilters?: () => void;
  isEmpty: boolean;
  showShelfSkeleton: boolean;
  onImport: () => void;
}

export default function HomePageShelfContent({
  shelf,
  families,
  mutations,
  mergeSuggestions,
  onDismissSuggestion,
  hasActiveFilters = false,
  onResetFilters,
  isEmpty,
  showShelfSkeleton,
  onImport,
}: HomePageShelfContentProps) {
  if (showShelfSkeleton) return <ShelfSkeleton />;
  if (isEmpty) return <WelcomeState onImport={onImport} />;

  return (
    <>
      <MergeSuggestionsBar
        suggestions={mergeSuggestions}
        onReview={mutations.selectFamilies}
        onDismiss={onDismissSuggestion}
      />
      <ShelfState
        families={families}
        shelfMode="covers"
        hasMore={!hasActiveFilters && shelf.hasMore}
        isLoadingMore={shelf.isLoadingMore}
        isRefreshing={shelf.isRefreshing}
        error={shelf.error}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={onResetFilters}
        onLoadMore={shelf.loadMore}
        selectionState={mutations.selectionState}
        onEnterSelection={mutations.enterSelection}
        onToggleSelected={mutations.toggleSelection}
        onDeleteFamilies={mutations.requestDelete}
      />
    </>
  );
}
