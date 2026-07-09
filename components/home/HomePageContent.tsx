'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import NavBar from '@/components/layout/NavBar';
import ShelfStats from '@/components/home/ShelfStats';
import ShelfSelectionBar from '@/components/home/ShelfSelectionBar';
import HomeHeader from '@/components/home/HomeHeader';
import HomeFooter from '@/components/home/HomeFooter';
import DeleteFamiliesDialog from '@/components/home/DeleteFamiliesDialog';
import MergeUndoToast from '@/components/home/MergeUndoToast';
import HomePageShelfContent from '@/components/home/HomePageShelfContent';
import { Button } from '@/components/ui/Button';
import { useUploads } from '@/lib/contexts/UploadContext';
import { clearFamilyDetailNegativeCacheForUser } from '@/lib/cache/familyDetailClient';
import { clearShelfFamilyCache, useInfiniteFamilies } from '@/lib/hooks/useInfiniteFamilies';
import { useShelfScrollRestoration } from '@/lib/hooks/useShelfScrollRestoration';
import { useShelfMutations } from '@/lib/hooks/useShelfMutations';
import { storePendingFonts } from '@/utils/pendingFonts';
import type { User } from 'firebase/auth';

export default function HomePageContent({ user }: { user: User }) {
  const router = useRouter();
  const { ingests: pendingIngests, onCompleted } = useUploads();
  const shelf = useInfiniteFamilies();
  const shelfScrollRef = useRef<HTMLDivElement>(null);
  const [shelfMode, setShelfMode] = useState<'spines' | 'covers'>('covers');
  const [coverSeed, setCoverSeed] = useState(0);
  const refreshShelf = useCallback(async () => {
    clearFamilyDetailNegativeCacheForUser(user.uid);
    clearShelfFamilyCache(user.uid);
    await shelf.reload();
  }, [shelf, user.uid]);
  const mutations = useShelfMutations({ user, refreshShelf });

  useEffect(() => onCompleted(() => { void refreshShelf(); }), [onCompleted, refreshShelf]);

  const handleFilesSelected = useCallback((files: File[]) => {
    if (files.length === 0) return;
    storePendingFonts(files, user.uid);
    router.push('/import');
  }, [router, user.uid]);
  const handleAddFonts = () => router.push('/import');
  const showShelfSkeleton = shelf.isInitialLoading && shelf.families.length === 0;
  const isEmpty = !showShelfSkeleton && shelf.families.length === 0 && pendingIngests.length === 0;
  const saveShelfScroll = useShelfScrollRestoration({
    uid: user.uid,
    scrollRef: shelfScrollRef,
    familyCount: shelf.families.length,
    hasMore: shelf.hasMore,
    isLoadingMore: shelf.isLoadingMore,
    loadMore: shelf.loadMore,
  });

  if (shelf.error && shelf.families.length === 0 && pendingIngests.length === 0) {
    return (
      <div className="text-center p-10 rule rounded-[var(--radius)] max-w-lg bg-[var(--surface)]">
        <p className="text-xl text-[var(--ink)]">{shelf.error}</p>
        <Button onClick={shelf.reload} className="mt-4 px-6" size="mdText">Try Again</Button>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col">
      <NavBar />
      <div
        ref={shelfScrollRef}
        data-shelf-scroll-root="true"
        onPointerDownCapture={saveShelfScroll}
        onClickCapture={saveShelfScroll}
        onKeyDownCapture={saveShelfScroll}
        className="flex-1 w-full h-full p-8 sm:p-10 md:p-12 lg:p-16 overflow-auto"
      >
        <HomeHeader isEmpty={isEmpty} onAddFonts={handleAddFonts} onRegenerateCovers={() => setCoverSeed((s) => s + 1)} />
        {!isEmpty && <ShelfStats stats={shelf.stats} pendingCount={pendingIngests.length} shelfMode={shelfMode} setShelfMode={setShelfMode} />}
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
        <HomePageShelfContent
          shelf={shelf}
          mutations={mutations}
          isEmpty={isEmpty}
          showShelfSkeleton={showShelfSkeleton}
          pendingIngests={pendingIngests}
          shelfMode={shelfMode}
          coverSeed={coverSeed}
          onAddFonts={handleAddFonts}
          onFilesSelected={handleFilesSelected}
        />
        <HomeFooter families={shelf.families} />
      </div>
      {mutations.pendingDeleteIds && <DeleteFamiliesDialog count={mutations.pendingDeleteIds.length} isDeleting={mutations.isMutating} error={mutations.deleteError} onCancel={() => !mutations.isMutating && mutations.setPendingDeleteIds(null)} onConfirm={mutations.confirmDelete} />}
      {mutations.mergeUndo && <MergeUndoToast undoExpiresAt={mutations.mergeUndo.undoExpiresAt} isMutating={mutations.isMutating} onUndo={mutations.undoMerge} onDismiss={() => mutations.setMergeUndo(null)} />}
    </div>
  );
}
