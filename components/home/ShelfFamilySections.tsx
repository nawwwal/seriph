'use client';

import { useMemo } from 'react';
import { FontFamily } from '@/models/font.models';
import type { ShelfFamily } from '@/models/shelf.models';
import type { ShelfSelectionState } from '@/lib/shelf/selectionState';
import { groupShelfFamilies, type ShelfFamilyGroup } from '@/lib/shelf/groupShelfFamilies';
import ShelfFamilyGrid from './ShelfFamilyGrid';
import { SHELF_GRID_CLASS } from './shelfGrid';

interface ShelfFamilySectionsProps {
  families: Array<FontFamily | ShelfFamily>;
  shelfMode: 'spines' | 'covers';
  coverSeed: number;
  isRefreshing: boolean;
  selectionState: ShelfSelectionState;
  onToggleSelected?: (familyId: string) => void;
  onOpenContextMenu: (event: { familyId: string; x: number; y: number }) => void;
}

type ShelfFamilyGroupProps = Omit<ShelfFamilySectionsProps, 'families'> & {
  groups: ShelfFamilyGroup[];
};

export function renderShelfFamilyGroups({
  groups,
  shelfMode,
  coverSeed,
  isRefreshing,
  selectionState,
  onToggleSelected,
  onOpenContextMenu,
}: ShelfFamilyGroupProps) {
  return groups.map((group) => (
    <section key={group.key} aria-labelledby={`shelf-group-${group.key}`}>
      <div className="mb-3 flex items-center gap-3">
        <h2 id={`shelf-group-${group.key}`} className="text-sm sm:text-base uppercase font-black leading-none">
          {group.label}
        </h2>
        <div className="h-px flex-1 bg-[var(--ink)] opacity-20" aria-hidden="true" />
      </div>
      <div className={SHELF_GRID_CLASS}>
        <ShelfFamilyGrid
          families={group.families}
          shelfMode={shelfMode}
          coverSeed={coverSeed}
          isRefreshing={isRefreshing}
          selectionState={selectionState}
          onToggleSelected={onToggleSelected}
          onOpenContextMenu={onOpenContextMenu}
        />
      </div>
    </section>
  ));
}

export default function ShelfFamilySections({
  families,
  shelfMode,
  coverSeed,
  isRefreshing,
  selectionState,
  onToggleSelected,
  onOpenContextMenu,
}: ShelfFamilySectionsProps) {
  const groupedFamilies = useMemo(() => groupShelfFamilies(families), [families]);
  return renderShelfFamilyGroups({
    groups: groupedFamilies,
    shelfMode,
    coverSeed,
    isRefreshing,
    selectionState,
    onToggleSelected,
    onOpenContextMenu,
  });
}
