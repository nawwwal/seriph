'use client';

import { useRef } from 'react';
import AlphabetRail from '@/components/home/AlphabetRail';
import HomeCatalogCanvas from '@/components/home/HomeCatalogCanvas';
import HomeShell from '@/components/home/HomeShell';
import ShelfStats from '@/components/home/ShelfStats';
import DeleteFamiliesDialog from '@/components/home/DeleteFamiliesDialog';
import MergeUndoToast from '@/components/home/MergeUndoToast';
import { useShelfScrollRestoration } from '@/lib/hooks/useShelfScrollRestoration';
import { useHomeShelfView } from './useHomeShelfView';
import type { User } from 'firebase/auth';

export default function HomePageContent({ user }: { user: User }) {
  const view = useHomeShelfView(user);
  const shelfScrollRef = useRef<HTMLDivElement>(null);
  const saveShelfScroll = useShelfScrollRestoration({
    uid: user.uid,
    scrollRef: shelfScrollRef,
    familyCount: view.shelf.families.length,
    hasMore: view.shelf.hasMore,
    isLoadingMore: view.shelf.isLoadingMore,
    loadMore: view.shelf.loadMore,
  });

  return (
    <>
      <HomeShell
        alphabetRail={(
          <AlphabetRail
            selected={view.activeInitial}
            presentInitials={view.presentInitials}
            onSelect={view.setSelectedInitial}
            onImport={view.handleAddFonts}
            uploadCount={view.uploadCount}
            onOpenUploads={view.openUploadCenter}
            filters={view.filters}
            moods={view.moods}
            onFiltersChange={view.setFilters}
          />
        )}
        statusStrip={<ShelfStats stats={view.shelf.stats} pendingCount={view.uploadCount} />}
        catalogCanvas={(
          <HomeCatalogCanvas
            view={view}
            scrollRef={shelfScrollRef}
            onScrollInteraction={saveShelfScroll}
          />
        )}
      />
      {view.mutations.pendingDeleteIds && (
        <DeleteFamiliesDialog
          count={view.mutations.pendingDeleteIds.length}
          isDeleting={view.mutations.isMutating}
          error={view.mutations.deleteError}
          onCancel={() => !view.mutations.isMutating && view.mutations.setPendingDeleteIds(null)}
          onConfirm={view.mutations.confirmDelete}
        />
      )}
      {view.mutations.mergeUndo && (
        <MergeUndoToast
          undoExpiresAt={view.mutations.mergeUndo.undoExpiresAt}
          isMutating={view.mutations.isMutating}
          onUndo={view.mutations.undoMerge}
          onDismiss={() => view.mutations.setMergeUndo(null)}
        />
      )}
    </>
  );
}
