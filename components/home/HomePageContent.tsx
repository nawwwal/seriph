'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import NavBar from '@/components/layout/NavBar';
import WelcomeState from '@/components/home/WelcomeState';
import ShelfState from '@/components/home/ShelfState';
import ShelfStats from '@/components/home/ShelfStats';
import ShelfSelectionBar from '@/components/home/ShelfSelectionBar';
import HomeHeader from '@/components/home/HomeHeader';
import HomeFooter from '@/components/home/HomeFooter';
import DeleteFamiliesDialog from '@/components/home/DeleteFamiliesDialog';
import MergeUndoToast from '@/components/home/MergeUndoToast';
import BatchHUD from '@/components/font/BatchHUD';
import ShelfSkeleton from '@/components/home/ShelfSkeleton';
import { useUploads } from '@/lib/contexts/UploadContext';
import { clearShelfFamilyCache, useInfiniteFamilies } from '@/lib/hooks/useInfiniteFamilies';
import { useShelfMutations } from '@/lib/hooks/useShelfMutations';
import { storePendingFonts } from '@/utils/pendingFonts';
import type { User } from 'firebase/auth';

export default function HomePageContent({ user }: { user: User }) {
  const router = useRouter();
  const { ingests: pendingIngests, onCompleted } = useUploads();
  const shelf = useInfiniteFamilies();
  const [shelfMode, setShelfMode] = useState<'spines' | 'covers'>('covers');
  const [coverSeed, setCoverSeed] = useState(0);
  const refreshShelf = useCallback(async () => {
    clearShelfFamilyCache(user.uid);
    await shelf.reload();
  }, [shelf, user.uid]);
  const mutations = useShelfMutations({ user, refreshShelf });

  useEffect(() => onCompleted(() => { void refreshShelf(); }), [onCompleted, refreshShelf]);

  const handleFilesSelected = useCallback((files: File[]) => {
    if (files.length === 0) return;
    storePendingFonts(files);
    router.push('/import');
  }, [router]);
  const handleAddFonts = () => router.push('/import');
  const showShelfSkeleton = shelf.isInitialLoading && shelf.families.length === 0;
  const isEmpty = !showShelfSkeleton && shelf.families.length === 0 && pendingIngests.length === 0;

  if (shelf.error && shelf.families.length === 0 && pendingIngests.length === 0) {
    return (
      <div className="text-center p-10 rule rounded-[var(--radius)] max-w-lg bg-[var(--surface)]">
        <p className="text-xl text-[var(--ink)]">{shelf.error}</p>
        <button onClick={shelf.reload} className="mt-4 px-6 py-2 rule rounded-[var(--radius)] btn-ink uppercase font-bold">Try Again</button>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col">
      <NavBar />
      <div className="flex-1 w-full h-full p-8 sm:p-10 md:p-12 lg:p-16 overflow-auto">
        <HomeHeader isEmpty={isEmpty} onAddFonts={handleAddFonts} onRegenerateCovers={() => setCoverSeed((s) => s + 1)} />
        {!isEmpty && <ShelfStats families={shelf.families} pendingCount={pendingIngests.length} shelfMode={shelfMode} setShelfMode={setShelfMode} />}
        {mutations.selectionState.mode === 'selecting' && (
          <ShelfSelectionBar
            selectedCount={mutations.selectedFamilyIds.length}
            canMerge={mutations.selectionCanMerge(mutations.selectionState)}
            isMutating={mutations.isMutating}
            error={mutations.mutationError}
            onMerge={mutations.mergeSelected}
            onDelete={() => mutations.requestDelete(mutations.selectedFamilyIds)}
            onCancel={mutations.cancelSelection}
          />
        )}
        <div aria-live="polite" aria-atomic="true" className="sr-only" id="status-announcements" />
        {showShelfSkeleton ? <ShelfSkeleton /> : isEmpty ? <WelcomeState onFilesSelected={handleFilesSelected} /> : (
          <>
            <ShelfState
              families={shelf.families}
              pendingIngests={pendingIngests}
              shelfMode={shelfMode}
              onAddFonts={handleAddFonts}
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
        )}
        <HomeFooter families={shelf.families} />
      </div>
      {mutations.pendingDeleteIds && <DeleteFamiliesDialog count={mutations.pendingDeleteIds.length} isDeleting={mutations.isMutating} error={mutations.deleteError} onCancel={() => !mutations.isMutating && mutations.setPendingDeleteIds(null)} onConfirm={mutations.confirmDelete} />}
      {mutations.mergeUndo && <MergeUndoToast undoExpiresAt={mutations.mergeUndo.undoExpiresAt} isMutating={mutations.isMutating} onUndo={mutations.undoMerge} onDismiss={() => mutations.setMergeUndo(null)} />}
    </div>
  );
}
