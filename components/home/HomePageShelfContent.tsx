'use client';

import BatchHUD from '@/components/font/BatchHUD';
import ShelfSkeleton from '@/components/home/ShelfSkeleton';
import ShelfState from '@/components/home/ShelfState';
import WelcomeState from '@/components/home/WelcomeState';
import type { useInfiniteFamilies } from '@/lib/hooks/useInfiniteFamilies';
import type { useShelfMutations } from '@/lib/hooks/useShelfMutations';
import type { ImportBatchSummary } from '@/lib/imports/mapImportBatch';
import type { ShelfFamily } from '@/models/shelf.models';

type ShelfController = ReturnType<typeof useInfiniteFamilies>;
type ShelfMutations = ReturnType<typeof useShelfMutations>;

interface HomePageShelfContentProps {
  shelf: ShelfController;
  families: ShelfFamily[];
  mutations: ShelfMutations;
  isEmpty: boolean;
  showShelfSkeleton: boolean;
  pendingBatches: ImportBatchSummary[];
  onFilesSelected: (files: File[]) => void;
}

export default function HomePageShelfContent({
  shelf,
  families,
  mutations,
  isEmpty,
  showShelfSkeleton,
  pendingBatches,
  onFilesSelected,
}: HomePageShelfContentProps) {
  if (showShelfSkeleton) return <ShelfSkeleton />;
  if (isEmpty) return <WelcomeState onFilesSelected={onFilesSelected} />;

  return (
    <>
      <ShelfState
        families={families}
        pendingBatches={pendingBatches}
        shelfMode="covers"
        hasMore={shelf.hasMore}
        isLoadingMore={shelf.isLoadingMore}
        isRefreshing={shelf.isRefreshing}
        onLoadMore={shelf.loadMore}
        selectionState={mutations.selectionState}
        onEnterSelection={mutations.enterSelection}
        onToggleSelected={mutations.toggleSelection}
        onDeleteFamilies={mutations.requestDelete}
      />
      {pendingBatches.length > 0 && <BatchHUD />}
    </>
  );
}
