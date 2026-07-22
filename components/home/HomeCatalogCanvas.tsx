'use client';

import type { RefObject } from 'react';
import ShelfSelectionBar from '@/components/home/ShelfSelectionBar';
import HomePageShelfContent from '@/components/home/HomePageShelfContent';
import { Button } from '@/components/ui/Button';
import type { useHomeShelfView } from './useHomeShelfView';

type HomeShelfView = ReturnType<typeof useHomeShelfView>;

interface HomeCatalogCanvasProps {
  view: HomeShelfView;
  scrollRef: RefObject<HTMLDivElement | null>;
  onScrollInteraction: () => void;
}

export default function HomeCatalogCanvas({
  view,
  scrollRef,
  onScrollInteraction,
}: HomeCatalogCanvasProps) {
  return (
    <div
      ref={scrollRef}
      data-shelf-scroll-root="true"
      onPointerDownCapture={onScrollInteraction}
      onClickCapture={onScrollInteraction}
      onKeyDownCapture={onScrollInteraction}
      className="h-full min-w-0 w-full max-w-full overflow-x-hidden overflow-y-auto p-4 sm:p-5 md:p-6"
    >
      {view.mutations.selectionState.mode === 'selecting' && (
        <ShelfSelectionBar
          selectedCount={view.mutations.selectedFamilyIds.length}
          canMerge={view.mutations.selectionCanMerge(view.mutations.selectionState)}
          isMutating={view.mutations.isMutating}
          error={view.mutations.mutationError}
          onMerge={view.mutations.mergeSelected}
          onDelete={() => view.mutations.requestDelete(view.mutations.selectedFamilyIds)}
          onCancel={view.mutations.cancelSelection}
        />
      )}
      <div aria-live="polite" aria-atomic="true" className="sr-only" id="status-announcements" />
      {view.hasBlockingError ? (
        <div className="m-auto max-w-lg p-10 text-center">
          <p className="text-xl text-[var(--ink)]">{view.shelf.error}</p>
          <Button onClick={view.shelf.reload} className="mt-4 px-6" size="mdText">Try Again</Button>
        </div>
      ) : (
        <HomePageShelfContent
          shelf={view.shelf}
          families={view.visibleFamilies}
          mutations={view.mutations}
          isEmpty={view.isEmpty}
          showShelfSkeleton={view.showShelfSkeleton}
          onImport={view.handleAddFonts}
        />
      )}
    </div>
  );
}
