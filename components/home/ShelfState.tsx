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
import ShelfFamilyGrid from './ShelfFamilyGrid';
import { useShelfUploadAnnouncements } from './useShelfUploadAnnouncements';
import AddFontsCard from './AddFontsCard';

interface ShelfStateProps {
  families: Array<FontFamily | ShelfFamily>;
  pendingIngests: IngestRecord[];
  shelfMode: 'spines' | 'covers';
  onAddFonts: () => void;
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
  onAddFonts,
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
  const { ref: sentinelRef, inView } = useInViewport<HTMLDivElement>('900px');
  const [contextMenu, setContextMenu] = useState<{ familyId: string; x: number; y: number } | null>(null);
  const openContextMenu = useCallback((event: { familyId: string; x: number; y: number }) => {
    setContextMenu(event);
  }, []);

  useEffect(() => {
    if (inView && hasMore && !isLoadingMore) onLoadMore?.();
  }, [hasMore, inView, isLoadingMore, onLoadMore]);

  return (
    <main className="mt-6 sm:mt-8 md:mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 grid-poster-gap auto-rows-fr">
      <AnimatePresence mode="popLayout">
        {activeUploads.map((ingest) => (
          <ShelfUploadCard key={`ingest-${ingest.id}`} ingest={ingest} reduceMotion={shouldReduceMotion} />
        ))}
      </AnimatePresence>

      <ShelfFamilyGrid
        families={families}
        shelfMode={shelfMode}
        coverSeed={coverSeed}
        isRefreshing={isRefreshing}
        selectionState={selectionState}
        onToggleSelected={onToggleSelected}
        onOpenContextMenu={openContextMenu}
      />

      <AddFontsCard onAddFonts={onAddFonts} />
      {(hasMore || isLoadingMore) && (
        <div ref={sentinelRef} className="col-span-full h-16 flex items-center justify-center uppercase text-xs font-bold opacity-70">
          {isLoadingMore ? 'Loading more families...' : 'More families ready'}
        </div>
      )}
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
