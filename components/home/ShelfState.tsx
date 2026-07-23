'use client';

import { FontFamily } from '@/models/font.models';
import type { ShelfFamily } from '@/models/shelf.models';
import { useCallback, useEffect, useState } from 'react';
import { useInViewport } from '@/lib/hooks/useInViewport';
import type { ShelfSelectionState } from '@/lib/shelf/selectionState';
import FamilyContextMenu from './FamilyContextMenu';
import ShelfFamilySections from './ShelfFamilySections';
import { ShelfCardSkeletons } from './ShelfSkeleton';
import { LOAD_MORE_SKELETON_COUNT } from './shelfGrid';

const PREFETCH_ROOT_MARGIN = '2800px 0px';

interface ShelfStateProps {
  families: Array<FontFamily | ShelfFamily>;
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
  const { ref: sentinelRef, inView } = useInViewport<HTMLDivElement>(PREFETCH_ROOT_MARGIN);
  const [contextMenu, setContextMenu] = useState<{ familyId: string; x: number; y: number } | null>(null);
  const openContextMenu = useCallback((event: { familyId: string; x: number; y: number }) => {
    setContextMenu(event);
  }, []);

  useEffect(() => {
    if (inView && hasMore && !isLoadingMore) onLoadMore?.();
  }, [hasMore, inView, isLoadingMore, onLoadMore]);

  return (
    <main className="space-y-8">
      <ShelfFamilySections
        families={families}
        shelfMode={shelfMode}
        coverSeed={coverSeed}
        isRefreshing={isRefreshing}
        selectionState={selectionState}
        onToggleSelected={onToggleSelected}
        onOpenContextMenu={openContextMenu}
        tail={(hasMore || isLoadingMore)
          ? <ShelfCardSkeletons count={LOAD_MORE_SKELETON_COUNT} />
          : null}
      />

      {hasMore && <div ref={sentinelRef} className="h-px w-full" aria-hidden="true" />}
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
