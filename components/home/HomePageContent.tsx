'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import AlphabetRail from '@/components/home/AlphabetRail';
import HomeShell from '@/components/home/HomeShell';
import ShelfStats from '@/components/home/ShelfStats';
import ShelfSelectionBar from '@/components/home/ShelfSelectionBar';
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
import {
  deriveAvailableInitials,
  filterFamiliesByInitial,
  type AlphabetInitial,
} from './alphabetFilter';
import type { User } from 'firebase/auth';

export default function HomePageContent({ user }: { user: User }) {
  const router = useRouter();
  const { activeCount, ingests: pendingIngests, onCompleted, open: openUploadCenter } = useUploads();
  const shelf = useInfiniteFamilies();
  const shelfScrollRef = useRef<HTMLDivElement>(null);
  const [selectedInitial, setSelectedInitial] = useState<AlphabetInitial>('ALL');
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
  const uploadCount = Math.max(activeCount, pendingIngests.length);
  const showShelfSkeleton = shelf.isInitialLoading && shelf.families.length === 0;
  const isEmpty = !showShelfSkeleton && shelf.families.length === 0 && pendingIngests.length === 0;
  const availableInitials = useMemo(() => deriveAvailableInitials(shelf.families), [shelf.families]);
  const activeInitial = selectedInitial !== 'ALL' && !availableInitials.includes(selectedInitial)
    ? 'ALL'
    : selectedInitial;
  const visibleFamilies = useMemo(
    () => filterFamiliesByInitial(shelf.families, activeInitial),
    [activeInitial, shelf.families]
  );
  const saveShelfScroll = useShelfScrollRestoration({
    uid: user.uid,
    scrollRef: shelfScrollRef,
    familyCount: shelf.families.length,
    hasMore: shelf.hasMore,
    isLoadingMore: shelf.isLoadingMore,
    loadMore: shelf.loadMore,
  });

  const hasBlockingError = shelf.error && shelf.families.length === 0 && pendingIngests.length === 0;

  return (
    <>
      <HomeShell
        alphabetRail={<AlphabetRail selected={activeInitial} availableInitials={availableInitials} onSelect={setSelectedInitial} onImport={handleAddFonts} uploadCount={uploadCount} onOpenUploads={openUploadCenter} />}
        statusStrip={<ShelfStats stats={shelf.stats} pendingCount={uploadCount} />}
        catalogCanvas={(
          <div ref={shelfScrollRef} data-shelf-scroll-root="true" onPointerDownCapture={saveShelfScroll} onClickCapture={saveShelfScroll} onKeyDownCapture={saveShelfScroll} className="h-full min-w-0 w-full max-w-full overflow-x-hidden overflow-y-auto p-4 sm:p-6">
            {mutations.selectionState.mode === 'selecting' && (
              <ShelfSelectionBar selectedCount={mutations.selectedFamilyIds.length} canMerge={mutations.selectionCanMerge(mutations.selectionState)} isMutating={mutations.isMutating} error={mutations.mutationError} onMerge={mutations.mergeSelected} onDelete={() => mutations.requestDelete(mutations.selectedFamilyIds)} onCancel={mutations.cancelSelection} />
            )}
            <div aria-live="polite" aria-atomic="true" className="sr-only" id="status-announcements" />
            {hasBlockingError ? (
              <div className="m-auto max-w-lg p-10 text-center">
                <p className="text-xl text-[var(--ink)]">{shelf.error}</p>
                <Button onClick={shelf.reload} className="mt-4 px-6" size="mdText">Try Again</Button>
              </div>
            ) : (
              <HomePageShelfContent shelf={shelf} families={visibleFamilies} mutations={mutations} isEmpty={isEmpty} showShelfSkeleton={showShelfSkeleton} pendingIngests={pendingIngests} onFilesSelected={handleFilesSelected} />
            )}
          </div>
        )}
      />
      {mutations.pendingDeleteIds && <DeleteFamiliesDialog count={mutations.pendingDeleteIds.length} isDeleting={mutations.isMutating} error={mutations.deleteError} onCancel={() => !mutations.isMutating && mutations.setPendingDeleteIds(null)} onConfirm={mutations.confirmDelete} />}
      {mutations.mergeUndo && <MergeUndoToast undoExpiresAt={mutations.mergeUndo.undoExpiresAt} isMutating={mutations.isMutating} onUndo={mutations.undoMerge} onDismiss={() => mutations.setMergeUndo(null)} />}
    </>
  );
}
