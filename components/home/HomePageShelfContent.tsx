'use client';

import BatchHUD from '@/components/font/BatchHUD';
import ShelfSkeleton from '@/components/home/ShelfSkeleton';
import ShelfState from '@/components/home/ShelfState';
import WelcomeState from '@/components/home/WelcomeState';
import type { useInfiniteFamilies } from '@/lib/hooks/useInfiniteFamilies';
import type { useShelfMutations } from '@/lib/hooks/useShelfMutations';
import type { IngestRecord } from '@/models/ingest.models';

type ShelfController = ReturnType<typeof useInfiniteFamilies>;
type ShelfMutations = ReturnType<typeof useShelfMutations>;

interface HomePageShelfContentProps {
  shelf: ShelfController;
  mutations: ShelfMutations;
  isEmpty: boolean;
  showShelfSkeleton: boolean;
  pendingIngests: IngestRecord[];
  shelfMode: 'spines' | 'covers';
  coverSeed: number;
  onAddFonts: () => void;
  onFilesSelected: (files: File[]) => void;
}

export default function HomePageShelfContent({
  shelf,
  mutations,
  isEmpty,
  showShelfSkeleton,
  pendingIngests,
  shelfMode,
  coverSeed,
  onAddFonts,
  onFilesSelected,
}: HomePageShelfContentProps) {
  if (showShelfSkeleton) return <ShelfSkeleton />;
  if (isEmpty) return <WelcomeState onFilesSelected={onFilesSelected} />;

  return (
    <>
      <ShelfState
        families={shelf.families}
        pendingIngests={pendingIngests}
        shelfMode={shelfMode}
        onAddFonts={onAddFonts}
        coverSeed={coverSeed}
        hasMore={shelf.hasMore}
        isLoadingMore={shelf.isLoadingMore}
        isRefreshing={shelf.isRefreshing}
        onLoadMore={shelf.loadMore}
        selectionState={mutations.selectionState}
        onEnterSelection={mutations.enterSelection}
        onToggleSelected={mutations.toggleSelection}
        onDeleteFamilies={mutations.requestDelete}
      />
      {pendingIngests.length > 0 && <BatchHUD />}
    </>
  );
}
