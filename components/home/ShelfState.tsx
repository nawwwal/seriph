'use client';

import { FontFamily } from '@/models/font.models';
import type { ShelfFamily } from '@/models/shelf.models';
import { IngestRecord } from '@/models/ingest.models';
import ShelfUploadCard from './ShelfUploadCard';
import { AnimatePresence, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { useInViewport } from '@/lib/hooks/useInViewport';
import type { ShelfSelectionState } from '@/lib/shelf/selectionState';
import FamilyContextMenu from './FamilyContextMenu';
import ShelfFamilySections from './ShelfFamilySections';
import { useShelfUploadAnnouncements } from './useShelfUploadAnnouncements';
import { ShelfCardSkeletonGrid } from './ShelfSkeleton';
import { LOAD_MORE_SKELETON_COUNT, SHELF_GRID_CLASS } from './shelfGrid';

const PREFETCH_ROOT_MARGIN = '2800px 0px';

interface ShelfStateProps {
  families: Array<FontFamily | ShelfFamily>;
  pendingIngests: IngestRecord[];
  shelfMode: 'spines' | 'covers';
  coverSeed?: number;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  isRefreshing?: boolean;
  onLoadMore?: () => void;
  selectionState?: ShelfSelectionState;
  onEnterSelection?: (familyId: string) => void;
  onToggleSelected?: (familyId: string) => void;
  onDeleteFamilies?: (familyIds: string[]) => void;
}

export default function ShelfState({
  families,
  pendingIngests,
  shelfMode,
  coverSeed = 0,
  hasMore = false,
  isLoadingMore = false,
  isRefreshing = false,
  onLoadMore,
  selectionState = { mode: 'idle' },
  onEnterSelection,
  onToggleSelected,
  onDeleteFamilies,
}: ShelfStateProps) {
  const activeUploads = useShelfUploadAnnouncements(pendingIngests);
  const shouldReduceMotion = useReducedMotion() ?? false;
  const { ref: sentinelRef, inView } = useInViewport<HTMLDivElement>(PREFETCH_ROOT_MARGIN);
  const [contextMenu, setContextMenu] = useState<{ familyId: string; x: number; y: number } | null>(null);
  const openContextMenu = useCallback((event: { familyId: string; x: number; y: number }) => {
    setContextMenu(event);
  }, []);

  useEffect(() => {
    if (inView && hasMore && !isLoadingMore) onLoadMore?.();
  }, [hasMore, inView, isLoadingMore, onLoadMore]);

  return (
    <main className="mt-6 sm:mt-8 md:mt-10 space-y-8">
      {activeUploads.length > 0 && (
        <div className={SHELF_GRID_CLASS}>
          <AnimatePresence mode="popLayout">
            {activeUploads.map((ingest) => (
              <ShelfUploadCard key={`ingest-${ingest.id}`} ingest={ingest} reduceMotion={shouldReduceMotion} />
            ))}
          </AnimatePresence>
        </div>
      )}

      <ShelfFamilySections
        families={families}
        shelfMode={shelfMode}
        coverSeed={coverSeed}
        isRefreshing={isRefreshing}
        selectionState={selectionState}
        onToggleSelected={onToggleSelected}
        onOpenContextMenu={openContextMenu}
      />

      {hasMore && <div ref={sentinelRef} className="h-px w-full" aria-hidden="true" />}
      {(hasMore || isLoadingMore) && <ShelfCardSkeletonGrid count={LOAD_MORE_SKELETON_COUNT} />}
      {contextMenu && (
        <FamilyContextMenu
          familyId={contextMenu.familyId}
          x={contextMenu.x}
          y={contextMenu.y}
          onSelect={(familyId) => onEnterSelection?.(familyId)}
          onDelete={(familyIds) => onDeleteFamilies?.(familyIds)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </main>
  );
}
