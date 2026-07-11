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
    <section key={group.key} aria-label={group.label} className="mb-6 last:mb-0">
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
