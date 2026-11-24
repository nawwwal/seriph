'use client';

import { FontFamily } from '@/models/font.models';
import type { ShelfFamily } from '@/models/shelf.models';
import { useCallback, useEffect, useState } from 'react';
import { useInViewport } from '@/lib/hooks/useInViewport';
import type { ShelfSelectionState } from '@/lib/shelf/selectionState';
import { Button } from '@/components/ui/Button';
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
  error?: string | null;
  hasActiveFilters?: boolean;
  onResetFilters?: () => void;
  onLoadMore?: () => void;
  selectionState?: ShelfSelectionState;
  onEnterSelection?: (familyId: string) => void;
  onToggleSelected?: (familyId: string) => void;
  onDeleteFamilies?: (familyIds: string[]) => void;
}

export default function ShelfState({
  families, shelfMode, coverSeed = 0, hasMore = false, isLoadingMore = false, isRefreshing = false,
  error = null, hasActiveFilters = false, onResetFilters, onLoadMore, selectionState = { mode: 'idle' },
  onEnterSelection, onToggleSelected, onDeleteFamilies,
}: ShelfStateProps) {
  const { ref: sentinelRef, inView } = useInViewport<HTMLDivElement>(PREFETCH_ROOT_MARGIN);
  const [contextMenu, setContextMenu] = useState<{ familyId: string; x: number; y: number } | null>(null);
  const openContextMenu = useCallback((event: { familyId: string; x: number; y: number }) => setContextMenu(event), []);

  useEffect(() => {
    if (inView && hasMore && !isLoadingMore && !error) onLoadMore?.();
  }, [error, hasMore, inView, isLoadingMore, onLoadMore]);

  if (families.length === 0 && hasActiveFilters) {
    return (
      <main className="rule mx-auto my-8 max-w-sm rounded-[var(--radius)] p-8 text-center">
        <p className="text-base font-bold uppercase">No matches</p>
        {onResetFilters && <Button type="button" onClick={onResetFilters} size="mdText" className="mt-4">Reset</Button>}
      </main>
    );
  }

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
        tail={(hasMore && !error) || isLoadingMore ? <ShelfCardSkeletons count={LOAD_MORE_SKELETON_COUNT} /> : null}
      />
      {error && onLoadMore && (
        <div role="alert" className="rule flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] px-4 py-3 text-sm">
          <span>{error}</span>
          <Button type="button" size="sm" onClick={onLoadMore}>Retry</Button>
        </div>
      )}
      {hasMore && !error && <div ref={sentinelRef} className="h-px w-full" aria-hidden="true" />}
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
